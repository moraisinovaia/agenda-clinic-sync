import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RealtimeConfig {
  table: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
}

// 🎯 SINGLETON GLOBAL: Gerenciador único de conexões realtime
class RealtimeManager {
  private channels = new Map<string, any>();
  private subscribers = new Map<string, Map<symbol, RealtimeConfig>>();
  private retryCount = new Map<string, number>();
  private isReconnecting = new Map<string, boolean>(); // ✅ FASE 1: Flag para evitar reconexões simultâneas
  private connectionTime = new Map<string, number>(); // ✅ FASE 1: Timestamp da última conexão
  private isRealtimeDisabled = new Map<string, boolean>(); // ✅ FASE 3: Flag para fallback polling
  private pollingIntervals = new Map<string, NodeJS.Timeout>(); // ✅ FASE 3: Intervalos de polling
  private readonly MAX_RETRY_ATTEMPTS = 10; // ✅ FASE 1: Reduzido de 50 para 10
  private readonly RETRY_COOLDOWN = 5 * 60 * 1000; // 5 minutos
  private readonly MIN_CONNECTION_TIME = 5000; // ✅ FASE 1: Conexão < 5s é considerada instável

  subscribe(table: string, config: RealtimeConfig): () => void {
    const subscriberId = Symbol('subscriber');
    
    // Adicionar subscriber
    if (!this.subscribers.has(table)) {
      this.subscribers.set(table, new Map());
    }
    this.subscribers.get(table)!.set(subscriberId, config);

    // ✅ FASE 3: Se Realtime desabilitado, usar polling
    if (this.isRealtimeDisabled.get(table)) {
      console.warn(`⚠️ [SINGLETON] Realtime desabilitado para ${table}, usando polling`);
      
      // Criar apenas um polling por tabela
      if (!this.pollingIntervals.has(table)) {
        const interval = setInterval(() => {
          console.log(`🔄 [POLLING] Refetch manual para ${table}`);
          this.notifySubscribers(table, 'onUpdate', { table });
        }, 15000); // Polling a cada 15s
        
        this.pollingIntervals.set(table, interval);
      }

      return () => {
        const tableSubscribers = this.subscribers.get(table);
        if (tableSubscribers) {
          tableSubscribers.delete(subscriberId);
          
          if (tableSubscribers.size === 0) {
            const interval = this.pollingIntervals.get(table);
            if (interval) {
              clearInterval(interval);
              this.pollingIntervals.delete(table);
            }
          }
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
        
        // Se não há mais subscribers, fechar canal
        if (tableSubscribers.size === 0) {
          this.removeChannel(table);
        }
      }
    };
  }

  private createChannel(table: string) {
    console.log(`🔌 [SINGLETON] Criando canal único para ${table}`);
    
    // ✅ FASE 1: Marcar timestamp da conexão
    this.connectionTime.set(table, Date.now());
    
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
          console.log(`✅ [SINGLETON] Realtime conectado para ${table}`);
          this.retryCount.set(table, 0);
          this.isReconnecting.set(table, false); // ✅ FASE 1: Resetar flag de reconexão
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
    // ✅ FASE 1: Prevenir reconexões simultâneas
    if (this.isReconnecting.get(table)) {
      console.log(`⚠️ [SINGLETON] Reconexão já em andamento para ${table}`);
      return;
    }

    // ✅ FASE 1: Verificar se a conexão foi muito curta (instável)
    const connTime = this.connectionTime.get(table) || 0;
    const duration = Date.now() - connTime;
    
    if (duration > this.MIN_CONNECTION_TIME) {
      console.log(`✅ [SINGLETON] Conexão ${table} durou ${duration}ms - não é instabilidade`);
      return; // Conexão foi longa o suficiente, não reconectar
    }

    console.warn(`⚠️ [SINGLETON] Conexão instável detectada para ${table} (durou apenas ${duration}ms)`);

    const currentRetries = this.retryCount.get(table) || 0;
    
    // ✅ FASE 3: Se atingiu limite, desabilitar Realtime e usar polling
    if (currentRetries >= this.MAX_RETRY_ATTEMPTS) {
      console.error(`❌ [SINGLETON] Realtime instável para ${table}. Desabilitando e usando polling.`);
      this.isRealtimeDisabled.set(table, true);
      this.removeChannel(table);
      
      // Notificar subscribers para ativar polling
      this.notifySubscribers(table, 'onUpdate', { 
        message: 'Realtime desabilitado, usando polling'
      });
      return;
    }
    
    this.isReconnecting.set(table, true);
    this.retryCount.set(table, currentRetries + 1);
    
    const delay = Math.min(2000 * Math.pow(1.5, currentRetries), 30000);
    console.log(`⏳ [SINGLETON] Reconectando ${table} (${currentRetries + 1}/${this.MAX_RETRY_ATTEMPTS}) em ${delay}ms`);
    
    setTimeout(() => {
      this.removeChannel(table);
      this.createChannel(table);
      this.isReconnecting.set(table, false);
    }, delay);
  }

  private removeChannel(table: string) {
    const channel = this.channels.get(table);
    if (channel) {
      console.log(`🔌 [SINGLETON] Removendo canal ${table}`);
      supabase.removeChannel(channel);
      this.channels.delete(table);
      this.subscribers.delete(table);
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

// 🎯 Instância global única
const realtimeManager = new RealtimeManager();

export const useRealtimeUpdates = (config: RealtimeConfig) => {
  useEffect(() => {
    const unsubscribe = realtimeManager.subscribe(config.table, config);
    return unsubscribe;
  }, [config.table, config.onInsert, config.onUpdate, config.onDelete]);
};