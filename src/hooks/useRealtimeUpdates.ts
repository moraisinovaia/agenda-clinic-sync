import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';

interface RealtimeConfig {
  table: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
}

export const useRealtimeUpdates = (config: RealtimeConfig) => {
  const { notifyNewAppointment, notifySystemError } = useNotifications();

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
    let retryTimeout: NodeJS.Timeout | null = null;
    
    const setupRealtime = () => {
      try {
        channel = supabase
          .channel(`realtime-${config.table}-${Date.now()}`) // Unique channel name
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
            console.log('Realtime status:', status);
            
            if (status === 'SUBSCRIBED') {
              console.log(`✅ Realtime connected for ${config.table}`);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              console.warn(`❌ Realtime connection issue for ${config.table}:`, status);
              
              // Only show error notification for critical failures, not connection retries
              if (status === 'CHANNEL_ERROR') {
                notifySystemError('Problema na conexão em tempo real');
              }
              
              // Retry connection after 5 seconds for non-critical failures
              if (status !== 'CLOSED') {
                retryTimeout = setTimeout(() => {
                  console.log(`🔄 Retrying realtime connection for ${config.table}`);
                  setupRealtime();
                }, 5000);
              }
            }
          });
      } catch (error) {
        console.error('Error setting up realtime:', error);
      }
    };

    setupRealtime();

    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [config.table, handleInsert, handleUpdate, handleDelete, notifySystemError]);
};