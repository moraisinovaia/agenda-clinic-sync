import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppointmentWithRelations } from '@/types/scheduling';
import { useToast } from '@/hooks/use-toast';
import { usePagination } from '@/hooks/usePagination';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { useDebounce } from '@/hooks/useDebounce';
import { logger } from '@/utils/logger';
import { deduplicateRequest, invalidateCache as invalidateRequestCache } from '@/utils/requestDeduplicator';
import { format } from 'date-fns';

// 🔄 QUERY DIRETA: Versão Otimizada 2025-10-27-17:00 - Solução definitiva com índices
export function useAppointmentsList(itemsPerPage: number = 20) {
  console.log('🏁 useAppointmentsList: Hook inicializado (Paginação Manual)');
  
  const { toast } = useToast();
  const { measureApiCall } = usePerformanceMetrics();
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastErrorRef = useRef<string | null>(null);
  const isOperatingRef = useRef(false);
  const isFetchingRef = useRef(false); // 🔒 Lock para prevenir múltiplas execuções simultâneas
  
  // 🔥 Estado local para appointments
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // ✅ FUNÇÃO DE QUERY DIRETA COM JOINS OTIMIZADOS + PAGINAÇÃO REAL
  const fetchAppointments = useCallback(async () => {
    return deduplicateRequest('appointments-list', async () => {
      const executionId = Math.random().toString(36).substring(7);
      console.log(`🚀 [FETCH-${executionId}] ========== INÍCIO DA BUSCA DE AGENDAMENTOS ==========`);
      
      isFetchingRef.current = true;
      console.log(`🔍 [FETCH-${executionId}] Iniciando busca otimizada (apenas futuros + limit 50)...`);
      
      return measureApiCall(async () => {
        try {
          // Buscar últimos 3 meses (incluindo passados recentes)
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          const dateFilter = threeMonthsAgo.toISOString().split('T')[0];
          console.log('📅 [FILTRO] Buscando agendamentos desde:', dateFilter);
          
          // 🚀 OTIMIZAÇÃO: Últimos 3 meses + limit 100
          const { data: allAppointments, error, count } = await supabase
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
            .limit(100);
          
          if (error) {
            console.error(`❌ [FETCH] Erro:`, error);
            logger.error('Erro ao buscar agendamentos', error, 'APPOINTMENTS');
            throw error;
          }
          
          const totalCount = count || 0;
          console.log(`📊 [RESULTADO] ${allAppointments?.length || 0} agendamentos carregados de ${totalCount} disponíveis (últimos 3 meses)`);
          
          if (!allAppointments || allAppointments.length === 0) {
            console.log(`ℹ️ [VAZIO] Nenhum agendamento futuro encontrado`);
            return [];
          }
        
          // Buscar profiles dos usuários em uma query separada
          console.log(`🔍 [PROFILES-START] Coletando user_ids...`);
          const userIds = new Set<string>();
          allAppointments.forEach((apt: any) => {
            if (apt.criado_por_user_id) userIds.add(apt.criado_por_user_id);
            if (apt.alterado_por_user_id) userIds.add(apt.alterado_por_user_id);
          });

          let profilesMap: Record<string, any> = {};
          
          if (userIds.size > 0) {
            console.log(`🔍 [PROFILES-QUERY] Buscando ${userIds.size} perfis via RPC...`);
            try {
              const { data: profiles, error: profilesError } = await supabase
                .rpc('get_user_profiles', { user_ids: Array.from(userIds) });
              
              if (profilesError) {
                console.warn('⚠️ [PROFILES-ERROR] Erro ao buscar perfis via RPC:', profilesError.message);
              } else if (profiles && profiles.length > 0) {
                console.log(`✅ [PROFILES-SUCCESS] ${profiles.length} perfis carregados`);
                profilesMap = profiles.reduce((acc, profile) => {
                  acc[profile.user_id] = profile;
                  return acc;
                }, {} as Record<string, any>);
              }
            } catch (err) {
              console.warn('⚠️ [PROFILES-CATCH] Falha ao buscar perfis via RPC:', err);
            }
          }
          
          // Transformar dados
          console.log(`🔄 [TRANSFORM] Transformando ${allAppointments.length} agendamentos...`);
          
          const transformedAppointments: AppointmentWithRelations[] = allAppointments.map((apt: any) => {
            const criadoPorProfile = apt.criado_por_user_id ? profilesMap[apt.criado_por_user_id] || null : null;
            const alteradoPorProfile = apt.alterado_por_user_id ? profilesMap[apt.alterado_por_user_id] || null : null;
            
            return {
              ...apt,
              pacientes: apt.pacientes || null,
              medicos: apt.medicos || null,
              atendimentos: apt.atendimentos || null,
              criado_por_profile: criadoPorProfile,
              alterado_por_profile: alteradoPorProfile,
            };
          });
          
          console.log(`✅ [FETCH-${executionId}] ========== BUSCA FINALIZADA ==========`);
          console.log(`📦 [FETCH-${executionId}] Total retornado: ${transformedAppointments.length} agendamentos`);

          logger.info('Agendamentos carregados com sucesso (otimizado)', { 
            count: transformedAppointments.length,
            total: totalCount
          }, 'APPOINTMENTS');

          return transformedAppointments;
        } catch (err) {
          console.error('❌ [FETCH] Erro fatal:', err);
          logger.error('Erro ao buscar agendamentos', err, 'APPOINTMENTS');
          throw err;
        } finally {
          isFetchingRef.current = false;
          console.log('🔓 [FETCH] Lock liberado');
        }
      }, 'fetch_appointments', 'GET');
    }, 3000); // 3 segundos de cache
  }, [measureApiCall]);

  // 🔥 BUSCAR DADOS DIRETAMENTE SEM CACHE
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchAppointments();
        console.log('📦 [HOOK-FINAL] Dados carregados:', {
          total: data.length,
          primeiro_tem_profile: !!data[0]?.criado_por_profile,
          primeiro_profile_nome: data[0]?.criado_por_profile?.nome,
          primeiro_criado_por: data[0]?.criado_por
        });
        setAppointments(data);
        setError(null);
      } catch (err) {
        console.error('❌ [HOOK-FINAL] Erro ao carregar:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [fetchAppointments]);

  // 🔥 Funções de refetch
  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAppointments();
      setAppointments(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [fetchAppointments]);

  const invalidateCache = useCallback(() => {
    invalidateRequestCache('appointments-list');
    refetch();
  }, [refetch]);

  const forceRefetch = useCallback(() => {
    invalidateRequestCache('appointments-list');
    refetch();
  }, [refetch]);

  // Log quando appointments mudar
  useEffect(() => {
    console.log('🔍 useAppointmentsList: Estado atual', {
      appointmentsCount: appointments?.length || 0,
      loading,
      hasError: !!error,
      errorMessage: error?.message,
      errorDetails: error,
      timestamp: new Date().toISOString()
    });
    
    if (appointments && !loading) {
      console.log('📊 [STATE] Appointments carregados:', {
        total: appointments.length,
        status_distribution: appointments.reduce((acc, apt) => {
          acc[apt.status] = (acc[apt.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });
    }
  }, [appointments, loading, error]);

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
