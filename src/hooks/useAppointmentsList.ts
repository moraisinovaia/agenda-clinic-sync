import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppointmentWithRelations } from '@/types/scheduling';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedQuery, clearAllCache } from '@/hooks/useOptimizedQuery';
import { usePagination } from '@/hooks/usePagination';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { useDebounce } from '@/hooks/useDebounce';
import { logger } from '@/utils/logger';

// 🔄 QUERY DIRETA: Versão Otimizada 2025-10-27-17:00 - Solução definitiva com índices
export function useAppointmentsList(itemsPerPage: number = 20) {
  console.log('🏁 useAppointmentsList: Hook inicializado (Query Direta)');
  
  const { toast } = useToast();
  const { measureApiCall } = usePerformanceMetrics();
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastErrorRef = useRef<string | null>(null);
  const isOperatingRef = useRef(false);

  // ✅ FUNÇÃO DE QUERY DIRETA COM JOINS OTIMIZADOS
  const fetchAppointments = useCallback(async () => {
    console.log('🔍 [FETCH] Iniciando busca com query direta...');
    
    return measureApiCall(async () => {
      try {
        // Filtrar últimos 6 meses
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const dateFilter = sixMonthsAgo.toISOString().split('T')[0];
        
        console.log('📅 [FILTRO] Buscando agendamentos desde:', dateFilter);
        
        // 1️⃣ QUERY DIRETA - Mais eficiente que RPC
        const { data: rawData, error, count } = await supabase
          .from('agendamentos')
          .select(`
            *,
            pacientes!inner(
              id,
              nome_completo,
              convenio,
              celular,
              telefone,
              data_nascimento
            ),
            medicos!inner(
              id,
              nome,
              especialidade,
              ativo
            ),
          atendimentos!inner(
              id,
              nome,
              tipo,
              medico_id
            )
          `, { count: 'exact' })
          .is('excluido_em', null)
          .gte('data_agendamento', dateFilter)
          .order('data_agendamento', { ascending: false })
          .order('hora_agendamento', { ascending: false })
          .range(0, 4999); // ✅ Até 5000 registros

        console.log('📊 [QUERY] Resposta recebida:', {
          registros_retornados: rawData?.length || 0,
          total_disponivel: count || 0,
          tem_erro: !!error,
          percentual_carregado: count ? `${((rawData?.length || 0) / count * 100).toFixed(1)}%` : '0%',
          timestamp: new Date().toISOString()
        });

        if (error) {
          console.error('❌ [QUERY] Erro na consulta:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            fullError: error
          });
          logger.error('Erro na consulta de agendamentos', error, 'APPOINTMENTS');
          throw error;
        }

        if (!rawData || rawData.length === 0) {
          console.warn('⚠️ [QUERY] Nenhum dado retornado!');
          return [];
        }

        // 2️⃣ TRANSFORMAR DADOS (Query direta já vem estruturada)
        console.log('🔄 [TRANSFORM] Transformando', rawData.length, 'registros...');
        const transformedAppointments: AppointmentWithRelations[] = rawData.map((apt: any) => ({
          ...apt,
          pacientes: apt.pacientes || null,
          medicos: apt.medicos || null,
          atendimentos: apt.atendimentos || null,
        }));

        // 3️⃣ ESTATÍSTICAS FINAIS
        console.log('✅ [FINAL] Resumo completo:', {
          total_disponivel: count || 0,
          carregados: transformedAppointments.length,
          timestamp: new Date().toISOString()
        });

        // 4️⃣ ANÁLISE POR STATUS
        const statusCount = transformedAppointments.reduce((acc, apt) => {
          acc[apt.status] = (acc[apt.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        console.log('📊 [STATUS] Distribuição:', statusCount);

        logger.info('Agendamentos carregados com sucesso', { 
          count: transformedAppointments.length,
          total: count || 0
        }, 'APPOINTMENTS');

        return transformedAppointments;
      } catch (err) {
        console.error('❌ [FETCH] Erro fatal:', err);
        logger.error('Erro ao buscar agendamentos', err, 'APPOINTMENTS');
        throw err;
      }
    }, 'fetch_appointments', 'GET');
  }, [measureApiCall]);

  // ✅ CACHE DESABILITADO TEMPORARIAMENTE PARA DEBUG
  const { data: appointments, loading, error, refetch, invalidateCache, forceRefetch } = useOptimizedQuery<AppointmentWithRelations[]>(
    fetchAppointments,
    [],
    { 
      cacheKey: `appointments-list-direct-v2025-10-27-${Date.now()}`, // 🔥 Forçar cache invalidation
      cacheTime: 0, // 🔥 Cache desabilitado para debug
      staleTime: 0 // 🔥 Sem stale
    }
  );

  // Log imediato após useOptimizedQuery
  console.log('🔍 useAppointmentsList: Estado atual', {
    appointmentsCount: appointments?.length || 0,
    loading,
    hasError: !!error,
    errorMessage: error?.message,
    errorDetails: error,
    timestamp: new Date().toISOString()
  });

  // Log quando appointments mudar
  useEffect(() => {
    if (appointments && !loading) {
      console.log('📊 [STATE] Appointments carregados:', {
        total: appointments.length,
        status_distribution: appointments.reduce((acc, apt) => {
          acc[apt.status] = (acc[apt.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });
    }
  }, [appointments, loading]);

  // Realtime updates
  useRealtimeUpdates({
    table: 'agendamentos',
    onInsert: (payload) => {
      if (isOperatingRef.current) return;
      console.log('🔄 [REALTIME] Novo agendamento inserido');
      setTimeout(() => {
        if (!isOperatingRef.current) {
          refetch();
          toast({
            title: "Novo agendamento",
            description: "Um novo agendamento foi criado!",
          });
        }
      }, 500);
    },
    onUpdate: (payload) => {
      if (isOperatingRef.current) return;
      console.log('🔄 [REALTIME] Agendamento atualizado');
      setTimeout(() => {
        if (!isOperatingRef.current) refetch();
      }, 300);
    },
    onDelete: (payload) => {
      if (isOperatingRef.current) return;
      console.log('🔄 [REALTIME] Agendamento deletado');
      setTimeout(() => {
        if (!isOperatingRef.current) refetch();
      }, 300);
    }
  });

  // Paginação
  const pagination = usePagination(appointments || [], { itemsPerPage });

  // Tratamento de erros
  const debouncedError = useDebounce(error, 1000);
  
  useEffect(() => {
    if (!debouncedError || isOperatingRef.current) return;
    
    const errorMessage = debouncedError.message || 'Erro desconhecido';
    
    if (lastErrorRef.current === errorMessage) return;
    lastErrorRef.current = errorMessage;
    
    const isTemporaryError = errorMessage.includes('network') || 
                           errorMessage.includes('timeout') ||
                           errorMessage.includes('aborted');
    
    if (isTemporaryError) return;
    
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    
    errorTimeoutRef.current = setTimeout(() => {
      if (debouncedError === error) {
        toast({
          title: 'Erro ao carregar agendamentos',
          description: 'Houve um problema ao carregar os dados.',
          variant: 'destructive',
        });
      }
      lastErrorRef.current = null;
    }, 2000);
    
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, [debouncedError, error, toast]);

  const getAppointmentsByDoctorAndDate = (doctorId: string, date: string) => {
    return (appointments || []).filter(
      appointment => 
        appointment.medico_id === doctorId && 
        appointment.data_agendamento === date
    );
  };

  const cancelAppointment = async (appointmentId: string) => {
    isOperatingRef.current = true;
    try {
      await measureApiCall(async () => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome, user_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();

        const { data, error } = await supabase.rpc('cancelar_agendamento_soft', {
          p_agendamento_id: appointmentId,
          p_cancelado_por: profile?.nome || 'Usuário',
          p_cancelado_por_user_id: profile?.user_id || null
        });

        if (error) throw error;
        if (!(data as any)?.success) throw new Error((data as any)?.error || 'Erro ao cancelar');
        return data;
      }, 'cancel_appointment', 'PUT');

      toast({ title: 'Agendamento cancelado', description: 'O agendamento foi cancelado com sucesso' });
      await refetch();
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível cancelar',
        variant: 'destructive',
      });
      throw error;
    } finally {
      isOperatingRef.current = false;
    }
  };

  const confirmAppointment = async (appointmentId: string) => {
    isOperatingRef.current = true;
    try {
      await measureApiCall(async () => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome, user_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();

        const { data, error } = await supabase.rpc('confirmar_agendamento', {
          p_agendamento_id: appointmentId,
          p_confirmado_por: profile?.nome || 'Usuário',
          p_confirmado_por_user_id: profile?.user_id || null
        });

        if (error) throw error;
        if (!(data as any)?.success) throw new Error((data as any)?.error || 'Erro ao confirmar');
        return data;
      }, 'confirm_appointment', 'PUT');

      await refetch();
      toast({ title: 'Agendamento confirmado', description: 'O agendamento foi confirmado com sucesso' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível confirmar',
        variant: 'destructive',
      });
      throw error;
    } finally {
      isOperatingRef.current = false;
    }
  };

  const unconfirmAppointment = async (appointmentId: string) => {
    isOperatingRef.current = true;
    try {
      await measureApiCall(async () => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome, user_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();

        const { data, error } = await supabase.rpc('desconfirmar_agendamento', {
          p_agendamento_id: appointmentId,
          p_desconfirmado_por: profile?.nome || 'Usuário',
          p_desconfirmado_por_user_id: profile?.user_id || null
        });

        if (error) throw error;
        const response = data as { success?: boolean; error?: string };
        if (!response || response.success === false) {
          throw new Error(response?.error || 'Erro ao desconfirmar');
        }
        return data;
      }, 'unconfirm_appointment', 'PUT');

      await refetch();
      toast({ title: 'Agendamento desconfirmado', description: 'O agendamento foi desconfirmado com sucesso' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível desconfirmar',
        variant: 'destructive',
      });
      throw error;
    } finally {
      isOperatingRef.current = false;
    }
  };

  const deleteAppointment = async (appointmentId: string) => {
    isOperatingRef.current = true;
    try {
      await measureApiCall(async () => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome, user_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();

        const { data, error } = await supabase.rpc('excluir_agendamento_soft', {
          p_agendamento_id: appointmentId,
          p_excluido_por: profile?.nome || 'Usuário',
          p_excluido_por_user_id: profile?.user_id || null
        });

        if (error) throw error;
        if (!(data as any)?.success) throw new Error((data as any)?.error || 'Erro ao excluir');
        return data;
      }, 'delete_appointment', 'PUT');

      toast({ title: 'Agendamento excluído', description: 'O agendamento foi excluído com sucesso' });
      await refetch();
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível excluir',
        variant: 'destructive',
      });
      throw error;
    } finally {
      isOperatingRef.current = false;
    }
  };

  return {
    appointments: appointments || [],
    loading,
    getAppointmentsByDoctorAndDate,
    cancelAppointment,
    deleteAppointment,
    confirmAppointment,
    unconfirmAppointment,
    refetch,
    invalidateCache,
    forceRefetch,
    pagination,
    error
  };
}
