import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RealtimeConfig {
  table: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
}

// 🎯 SINGLETON GLOBAL: Gerenciador único de conexões realtime v5.1 - POLLING HÍBRIDO CONTÍNUO
class RealtimeManager {
  private channels = new Map<string, any>();
  private subscribers = new Map<string, Map<symbol, RealtimeConfig>>();
  private retryCount = new Map<string, number>();
  private isReconnecting = new Map<string, boolean>();
  private connectionTime = new Map<string, number>();
  private isRealtimeDisabled = new Map<string, boolean>();
  private pollingIntervals = new Map<string, NodeJS.Timeout>();
  private hybridPollingActive = new Map<string, boolean>(); // ✅ Polling híbrido ativo
  private readonly VERSION = '5.1.0'; // ✅ Versão 5.1 com polling contínuo (nunca para no cleanup)
  private readonly MAX_RETRY_ATTEMPTS = 20;
  private readonly RETRY_COOLDOWN = 5 * 60 * 1000;
  private readonly MIN_CONNECTION_TIME = 10000; // ✅ REDUZIDO: 10 segundos (era 30s)
  private readonly STABLE_CONNECTION_RESET = 5 * 60 * 1000;
  
  // ✅ Intervalos de polling por tabela (agendamentos = 5s, outros = 15s)
  private readonly POLLING_INTERVALS: Record<string, number> = {
    'agendamentos': 5000,  // 5 segundos para agendamentos (crítico)
    'default': 15000       // 15 segundos para outras tabelas
  };

  constructor() {
    // ✅ Limpar estado ao inicializar
    this.isRealtimeDisabled.clear();
    this.retryCount.clear();
    this.hybridPollingActive.clear();
    console.log(`🎯 [SINGLETON v${this.VERSION}] RealtimeManager inicializado (polling híbrido ativo)`);
  }

  // ✅ Método para forçar reset do Realtime
  resetRealtime(table?: string) {
    if (table) {
      this.isRealtimeDisabled.delete(table);
      this.retryCount.delete(table);
      this.stopHybridPolling(table);
      console.log(`🔄 [RESET] Realtime resetado para ${table}`);
    } else {
      this.isRealtimeDisabled.clear();
      this.retryCount.clear();
      this.pollingIntervals.forEach((_, key) => this.stopHybridPolling(key));
      console.log(`🔄 [RESET] Realtime resetado para todas as tabelas`);
    }
  }

  private getPollingInterval(table: string): number {
    return this.POLLING_INTERVALS[table] || this.POLLING_INTERVALS['default'];
  }

  // ✅ NOVO: Iniciar polling híbrido IMEDIATAMENTE
  private startHybridPolling(table: string) {
    if (this.pollingIntervals.has(table)) {
      console.log(`⚡ [HYBRID] Polling já ativo para ${table}`);
      return;
    }
    
    const interval = this.getPollingInterval(table);
    console.log(`⚡ [HYBRID v${this.VERSION}] ATIVANDO POLLING IMEDIATO para ${table} (${interval/1000}s)`);
    this.hybridPollingActive.set(table, true);
    
    // ✅ Executar imediatamente na primeira vez
    this.notifySubscribers(table, 'onInsert', { 
      _polling: true, 
      _forceRefresh: true, 
      new: null 
    });
    
    const pollingId = setInterval(() => {
      console.log(`🔄 [HYBRID] Polling ${table}...`);
      this.notifySubscribers(table, 'onInsert', { 
        _polling: true, 
        _forceRefresh: true, 
        new: null 
      });
    }, interval);
    
    this.pollingIntervals.set(table, pollingId);
  }

  // ✅ NOVO: Parar polling híbrido
  private stopHybridPolling(table: string) {
    const interval = this.pollingIntervals.get(table);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(table);
      this.hybridPollingActive.delete(table);
      console.log(`⏹️ [HYBRID] Polling parado para ${table}`);
    }
  }

  subscribe(table: string, config: RealtimeConfig): () => void {
    const subscriberId = Symbol('subscriber');
    
    if (!this.subscribers.has(table)) {
      this.subscribers.set(table, new Map());
    }
    this.subscribers.get(table)!.set(subscriberId, config);

    // ✅ Se Realtime completamente desabilitado, usar apenas polling
    if (this.isRealtimeDisabled.get(table)) {
      console.warn(`⚠️ [SINGLETON v${this.VERSION}] Realtime desabilitado para ${table}, usando POLLING`);
      this.startHybridPolling(table);

      return () => {
        const tableSubscribers = this.subscribers.get(table);
        if (tableSubscribers) {
          tableSubscribers.delete(subscriberId);
          // ✅ CORREÇÃO v5.1: NUNCA parar polling no cleanup (mesmo quando Realtime desabilitado)
          console.log(`⚡ [HYBRID] Mantendo polling ativo para ${table} (cleanup isRealtimeDisabled)`);
        }
      };
    }

    // Criar canal se não existe
    if (!this.channels.has(table)) {
      this.createChannel(table);
    }

    // Retornar função de cleanup
    return () => {
      const tableSubscribers = this.subscribers.get(table);
      if (tableSubscribers) {
        tableSubscribers.delete(subscriberId);
        
        if (tableSubscribers.size === 0) {
          this.removeChannel(table);
          // ✅ CORREÇÃO v5.1: NUNCA parar polling no cleanup
          // Polling só para quando conexão está estável por 5 minutos
          console.log(`⚡ [HYBRID] Mantendo polling ativo para ${table} (cleanup sem stop)`);
        }
      }
    };
  }
  
  // ✅ NOVO: Método público para forçar início do polling híbrido
  public startHybridPollingPublic(table: string) {
    this.startHybridPolling(table);
  }
  
  // ✅ NOVO: Método público para parar polling híbrido
  public stopHybridPollingPublic(table: string) {
    this.stopHybridPolling(table);
  }

  private createChannel(table: string) {
    console.log(`🔌 [SINGLETON] Criando canal único para ${table}`);
    
    this.connectionTime.set(table, Date.now());
    
    // ✅ CORREÇÃO: Iniciar polling híbrido SEMPRE ao criar canal (modo seguro)
    if (!this.hybridPollingActive.get(table)) {
      console.log(`⚡ [HYBRID] Ativando polling preventivo para ${table}`);
      this.startHybridPolling(table);
    }
    
    const channel = supabase
      .channel(`realtime-${table}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table },
        (payload) => this.notifySubscribers(table, 'onInsert', payload)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table },
        (payload) => this.notifySubscribers(table, 'onUpdate', payload)
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table },
        (payload) => this.notifySubscribers(table, 'onDelete', payload)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ [SINGLETON v${this.VERSION}] Realtime conectado para ${table}`);
          this.isReconnecting.set(table, false);
          
          // ✅ NOVO: Parar polling híbrido quando conexão estabilizar
          setTimeout(() => {
            const connTime = this.connectionTime.get(table) || 0;
            const duration = Date.now() - connTime;
            if (duration >= this.STABLE_CONNECTION_RESET) {
              const previousRetries = this.retryCount.get(table) || 0;
              if (previousRetries > 0) {
                console.log(`✅ [SINGLETON v${this.VERSION}] Conexão ${table} estável - resetando contador`);
                this.retryCount.set(table, 0);
              }
              // ✅ Parar polling quando conexão está estável
              if (this.hybridPollingActive.get(table)) {
                console.log(`✅ [HYBRID] Conexão estável, desativando polling para ${table}`);
                this.stopHybridPolling(table);
              }
            }
          }, this.STABLE_CONNECTION_RESET);
        } else if (status === 'CLOSED') {
          console.log(`⚠️ [SINGLETON] Conexão fechada para ${table}`);
          this.handleReconnect(table);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ [SINGLETON] Erro no canal ${table}`);
          this.handleReconnect(table);
        }
      });

    this.channels.set(table, channel);
  }

  private handleReconnect(table: string) {
    if (this.isReconnecting.get(table)) {
      console.log(`⚠️ [SINGLETON] Reconexão já em andamento para ${table}`);
      return;
    }

    const connTime = this.connectionTime.get(table) || 0;
    const duration = Date.now() - connTime;
    
    // ✅ NOVO: Ativar polling híbrido IMEDIATAMENTE se conexão foi instável
    if (duration < this.MIN_CONNECTION_TIME) {
      console.warn(`⚠️ [SINGLETON v${this.VERSION}] Conexão instável para ${table} (${Math.floor(duration/1000)}s < ${this.MIN_CONNECTION_TIME/1000}s)`);
      
      // ⚡ ATIVAR POLLING HÍBRIDO IMEDIATAMENTE (não esperar 20 tentativas!)
      if (!this.hybridPollingActive.get(table)) {
        this.startHybridPolling(table);
      }
    } else {
      console.log(`✅ [SINGLETON v${this.VERSION}] Conexão ${table} durou ${Math.floor(duration/1000)}s - estável`);
      this.retryCount.set(table, 0);
      return;
    }

    const currentRetries = this.retryCount.get(table) || 0;
    
    // ✅ Se atingiu limite, desabilitar Realtime completamente
    if (currentRetries >= this.MAX_RETRY_ATTEMPTS) {
      console.error(`❌ [SINGLETON v${this.VERSION}] Limite de tentativas para ${table} - desabilitando Realtime`);
      this.isRealtimeDisabled.set(table, true);
      this.removeChannel(table);
      return;
    }
    
    this.isReconnecting.set(table, true);
    this.retryCount.set(table, currentRetries + 1);
    
    const delay = Math.min(2000 * Math.pow(1.5, currentRetries), 30000);
    console.log(`⏳ [SINGLETON v${this.VERSION}] Reconectando ${table} (${currentRetries + 1}/${this.MAX_RETRY_ATTEMPTS}) em ${delay}ms`);
    
    setTimeout(() => {
      // ✅ CORREÇÃO: Preservar subscribers durante reconexão
      this.removeChannel(table, true);
      this.createChannel(table);
      this.isReconnecting.set(table, false);
      // ✅ NÃO parar polling aqui - só para quando conexão estabilizar
    }, delay);
  }

  // ✅ CORRIGIDO: Aceita flag para preservar subscribers durante reconexão
  private removeChannel(table: string, preserveSubscribers = false) {
    const channel = this.channels.get(table);
    if (channel) {
      console.log(`🔌 [SINGLETON] Removendo canal ${table} (preserveSubscribers: ${preserveSubscribers})`);
      supabase.removeChannel(channel);
      this.channels.delete(table);
      
      // ✅ Só deletar subscribers se for cleanup final, não durante reconexão
      if (!preserveSubscribers) {
        this.subscribers.delete(table);
      }
    }
  }

  private notifySubscribers(table: string, event: keyof RealtimeConfig, payload: any) {
    const tableSubscribers = this.subscribers.get(table);
    if (!tableSubscribers) return;

    tableSubscribers.forEach((config) => {
      try {
        const callback = config[event];
        if (typeof callback === 'function') {
          callback(payload);
        }
      } catch (error) {
        console.error(`❌ [SINGLETON] Erro ao notificar subscriber de ${table}:`, error);
      }
    });
  }
}

// 🎯 Instância global única v2.0 - Forçar recriação
const realtimeManager = new RealtimeManager();
console.log('🔄 [SINGLETON] Nova instância do RealtimeManager criada');

export const useRealtimeUpdates = (config: RealtimeConfig) => {
  useEffect(() => {
    const unsubscribe = realtimeManager.subscribe(config.table, config);
    return unsubscribe;
  }, [config.table, config.onInsert, config.onUpdate, config.onDelete]);
};