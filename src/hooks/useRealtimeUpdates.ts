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
            } else if (status === 'CLOSED') {
              isSubscribed = false;
              console.log(`Connection closed for ${config.table}`);
            }
            // Removida lógica de retry automático para evitar loops
          });
      } catch (error) {
        console.error('Error setting up realtime:', error);
      }
    };

    setupRealtime();

    return () => {
      isSubscribed = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [config.table]); // Removidas dependências desnecessárias
};