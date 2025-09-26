import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';
import { useDebounce } from '@/hooks/useDebounce';

interface RealtimeConfig {
  table: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
}

export const useRealtimeUpdates = (config: RealtimeConfig) => {
  const { notifyNewAppointment, notifySystemError } = useNotifications();
  const connectionRetryRef = useRef<NodeJS.Timeout | null>(null);
  const maxRetries = 3;
  const retryCountRef = useRef(0);

  const handleInsert = useCallback((payload: any) => {
    console.log('New insert:', payload);
    config.onInsert?.(payload);
    
    // Auto-notify for new appointments
    if (config.table === 'agendamentos') {
      notifyNewAppointment(
        'Novo paciente',
        'Médico',
        new Date().toLocaleTimeString('pt-BR')
      );
    }
  }, [config, notifyNewAppointment]);

  const handleUpdate = useCallback((payload: any) => {
    console.log('Update:', payload);
    config.onUpdate?.(payload);
  }, [config]);

  const handleDelete = useCallback((payload: any) => {
    console.log('Delete:', payload);
    config.onDelete?.(payload);
  }, [config]);

  useEffect(() => {
    let channel: any = null;
    let isSubscribed = false;
    
    const setupRealtime = () => {
      // Não criar novos canais se já estamos conectados
      if (isSubscribed) return;
      
      try {
        channel = supabase
          .channel(`realtime-${config.table}`) // Nome fixo sem timestamp
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: config.table,
            },
            handleInsert
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: config.table,
            },
            handleUpdate
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: config.table,
            },
            handleDelete
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log(`✅ Realtime connected for ${config.table}`);
              isSubscribed = true;
              retryCountRef.current = 0; // Reset retry count on successful connection
            } else if (status === 'CLOSED') {
              isSubscribed = false;
              console.log(`Connection closed for ${config.table}`);
              
              // Tentar reconectar apenas se não excedeu o limite de tentativas
              if (retryCountRef.current < maxRetries) {
                retryCountRef.current += 1;
                console.log(`Attempting reconnection ${retryCountRef.current}/${maxRetries}`);
                
                connectionRetryRef.current = setTimeout(() => {
                  if (!isSubscribed) {
                    setupRealtime();
                  }
                }, 2000 * retryCountRef.current); // Backoff exponencial
              } else {
                console.log('Max retry attempts reached. Stopping reconnection attempts.');
              }
            } else if (status === 'CHANNEL_ERROR') {
              console.error(`Channel error for ${config.table}`);
              isSubscribed = false;
            }
          });
      } catch (error) {
        console.error('Error setting up realtime:', error);
        isSubscribed = false;
      }
    };

    setupRealtime();

    return () => {
      isSubscribed = false;
      if (connectionRetryRef.current) {
        clearTimeout(connectionRetryRef.current);
      }
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [config.table, handleInsert, handleUpdate, handleDelete]);
};