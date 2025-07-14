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
    const channel = supabase
      .channel(`realtime-${config.table}`)
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
        if (status === 'SUBSCRIPTION_ERROR') {
          notifySystemError('Erro na conexão em tempo real');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [config.table, handleInsert, handleUpdate, handleDelete, notifySystemError]);
};