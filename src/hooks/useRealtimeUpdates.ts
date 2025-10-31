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
  private readonly MAX_RETRY_ATTEMPTS = 50;
  private readonly RETRY_COOLDOWN = 5 * 60 * 1000; // 5 minutos

  subscribe(table: string, config: RealtimeConfig): () => void {
    const subscriberId = Symbol('subscriber');
    
    // Adicionar subscriber
    if (!this.subscribers.has(table)) {
      this.subscribers.set(table, new Map());
    }
    this.subscribers.get(table)!.set(subscriberId, config);

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
    const currentRetries = this.retryCount.get(table) || 0;
    
    if (currentRetries < this.MAX_RETRY_ATTEMPTS) {
      this.retryCount.set(table, currentRetries + 1);
      const delay = Math.min(2000 * Math.pow(1.5, currentRetries), 30000);
      
      console.log(`⏳ [SINGLETON] Reconectando ${table} (${currentRetries + 1}/${this.MAX_RETRY_ATTEMPTS}) em ${delay}ms`);
      
      setTimeout(() => {
        this.removeChannel(table);
        this.createChannel(table);
      }, delay);
    } else {
      console.warn(`⚠️ [SINGLETON] Limite de tentativas atingido para ${table}. Aguardando cooldown de 5min.`);
      
      // Reset após cooldown
      setTimeout(() => {
        console.log(`🔄 [SINGLETON] Reset de tentativas para ${table}`);
        this.retryCount.set(table, 0);
      }, this.RETRY_COOLDOWN);
    }
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