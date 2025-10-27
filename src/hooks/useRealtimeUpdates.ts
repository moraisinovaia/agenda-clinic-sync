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
  const retryCountRef = useRef(0);
  const channelRef = useRef<any>(null);

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
    let isSubscribed = false;
    let isMounted = true;
    
    const setupRealtime = () => {
      // Não criar novos canais se já estamos conectados ou se o canal já existe
      if (isSubscribed || channelRef.current) return;
      
      try {
        // Usar timestamp único para evitar conflitos de múltiplos componentes
        const channelName = `realtime-${config.table}-${Date.now()}`;
        const channel = supabase
          .channel(channelName)
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
            if (!isMounted) return;
            
            if (status === 'SUBSCRIBED') {
              console.log(`✅ Realtime connected for ${config.table}`);
              isSubscribed = true;
              retryCountRef.current = 0;
              channelRef.current = channel;
            } else if (status === 'CLOSED') {
              isSubscribed = false;
              channelRef.current = null;
              console.log(`Connection closed for ${config.table}`);
              
              // Reconexão inteligente com backoff exponencial (SEM LIMITE)
              if (isMounted) {
                retryCountRef.current += 1;
                const delay = Math.min(2000 * Math.pow(1.5, retryCountRef.current), 30000); // Máximo 30s
                console.log(`Attempting reconnection ${retryCountRef.current} in ${delay}ms`);
                
                connectionRetryRef.current = setTimeout(() => {
                  if (isMounted && !isSubscribed) {
                    setupRealtime();
                  }
                }, delay);
              }
            } else if (status === 'CHANNEL_ERROR') {
              console.error(`Channel error for ${config.table}`);
              isSubscribed = false;
              channelRef.current = null;
              
              // Tentar reconectar após erro
              if (isMounted) {
                retryCountRef.current += 1;
                const delay = Math.min(5000 * Math.pow(1.5, retryCountRef.current), 60000);
                connectionRetryRef.current = setTimeout(() => {
                  if (isMounted && !isSubscribed) {
                    setupRealtime();
                  }
                }, delay);
              }
            }
          });
      } catch (error) {
        console.error('Error setting up realtime:', error);
        isSubscribed = false;
        channelRef.current = null;
      }
    };

    setupRealtime();

    return () => {
      isMounted = false;
      isSubscribed = false;
      
      if (connectionRetryRef.current) {
        clearTimeout(connectionRetryRef.current);
        connectionRetryRef.current = null;
      }
      
      if (channelRef.current) {
        console.log(`🔌 Removing channel for ${config.table}`);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [config.table, handleInsert, handleUpdate, handleDelete]);
};