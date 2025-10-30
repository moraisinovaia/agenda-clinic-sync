import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppointmentWithRelations } from '@/types/scheduling';
import { useToast } from '@/hooks/use-toast';
import { usePagination } from '@/hooks/usePagination';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { useDebounce } from '@/hooks/useDebounce';
import { logger } from '@/utils/logger';

// 🚨 OTIMIZAÇÃO FASE 2: Cache movido para dentro do hook (local por instância)
// Removido singleton global para evitar memory leaks e data duplication
const CACHE_DURATION = 30000; // 30 segundos

// 🔄 QUERY DIRETA: Versão Otimizada 2025-10-27-17:00 - Solução definitiva com índices
export function useAppointmentsList(itemsPerPage: number = 20) {
  console.log('🏁 useAppointmentsList: Hook inicializado (Paginação Manual + Cache Local)');
  
  const { toast } = useToast();
  const { measureApiCall } = usePerformanceMetrics();
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastErrorRef = useRef<string | null>(null);
  const isOperatingRef = useRef(false);
  const refetchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // 🚨 OTIMIZAÇÃO FASE 2: Cache local por instância usando refs
  const fetchPromiseRef = useRef<Promise<AppointmentWithRelations[]> | null>(null);
  const fetchTimestampRef = useRef<number>(0);
  
  // 🔥 Estado local para appointments
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // ✅ FUNÇÃO DE QUERY DIRETA COM JOINS OTIMIZADOS
  const fetchAppointments = useCallback(async () => {
    const executionId = Math.random().toString(36).substring(7);
    const now = Date.now();
    
    // 🔍 Verificar cache local antes de fazer nova chamada
    if (fetchPromiseRef.current && (now - fetchTimestampRef.current) < CACHE_DURATION) {
      console.log('♻️ [CACHE HIT] Reutilizando chamada local existente');
      return fetchPromiseRef.current;
    }
    
    // ✅ Se já tem fetch em andamento, aguardar
    if (fetchPromiseRef.current) {
      console.log('⏸️ [CACHE] Aguardando fetch em andamento...');
      return fetchPromiseRef.current;
    }
    
    // 🆕 Criar novo fetch
    console.log(`🚀 [FETCH-${executionId}] ========== INÍCIO DA BUSCA DE AGENDAMENTOS ==========`);
    fetchTimestampRef.current = now;
    
    fetchPromiseRef.current = measureApiCall(async () => {
      try {
        // 🚨 OTIMIZAÇÃO: Reduzir de 6 para 3 meses
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const dateFilter = threeMonthsAgo.toISOString().split('T')[0];
        
        console.log('📅 [FILTRO] Buscando desde:', dateFilter);
        
        // 🔥 PAGINAÇÃO MANUAL - Buscar em blocos de 1000
        let allAppointments: any[] = [];
        let currentPage = 0;
        const pageSize = 1000; // ✅ Limite real do Supabase PostgREST
        let hasMore = true;
        let totalCount = 0;
        
        while (hasMore) {
          const start = currentPage * pageSize;
          const end = start + pageSize - 1;
          
          console.log(`📦 [PÁGINA ${currentPage + 1}] Buscando registros ${start}-${end}...`);
          
            const { data: pageData, error, count } = await supabase
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
            .range(start, end);
          
          if (error) {
            console.error(`❌ [PÁGINA ${currentPage + 1}] Erro:`, error);
            logger.error('Erro na paginação de agendamentos', error, 'APPOINTMENTS');
            throw error;
          }
          
          if (count !== null && currentPage === 0) {
            totalCount = count;
            console.log(`📊 [TOTAL] ${totalCount} agendamentos disponíveis no banco`);
            console.log(`🔍 [PRIMEIRA PÁGINA] Recebidos ${pageData?.length || 0} registros`);
          }
          
          if (!pageData || pageData.length === 0) {
            console.log(`✅ [PÁGINA ${currentPage + 1}] Sem mais dados`);
            hasMore = false;
            break;
          }
          
          allAppointments = [...allAppointments, ...pageData];
          console.log(`✅ [PÁGINA ${currentPage + 1}] ${pageData.length} registros carregados (total acumulado: ${allAppointments.length}/${totalCount})`);
          
          // 📊 LOG: Status dos últimos 5 registros da página
          if (pageData && pageData.length > 0) {
            console.log(`📊 [STATUS] Últimos 5 registros da página ${currentPage + 1}:`, 
              pageData.slice(-5).map(a => ({ 
                id: a.id, 
                status: a.status, 
                data: a.data_agendamento 
              }))
            );
          }
          
          currentPage++; // ✅ Incrementar PRIMEIRO
          
          // 🔍 DEBUG: Verificar progresso
          console.log(`🔍 [DEBUG] Página ${currentPage}: ${pageData.length} registros recebidos`);
          console.log(`🔍 [DEBUG] Total acumulado: ${allAppointments.length}/${totalCount}`);
          
          // ✅ Parar APENAS quando não há dados OU já temos todos os registros
          if (pageData.length === 0) {
            console.log(`✅ [FINAL] Sem mais dados na página ${currentPage}`);
            hasMore = false;
          } else if (allAppointments.length >= totalCount) {
            console.log(`✅ [FINAL] Todos os ${totalCount} registros carregados`);
            hasMore = false;
          }
          // ❌ REMOVIDO: else if (pageData.length < pageSize) - Causava parada prematura
          
          // 🚨 OTIMIZAÇÃO: Reduzir de 20 para 5 páginas (5k registros)
          if (currentPage >= 5) {
            console.warn('⚠️ Limite de segurança: 5 páginas atingido (reduzido de 20 para economizar memória)');
            hasMore = false;
          }
        }
        
        console.log(`✅ [FINAL] Total carregado: ${allAppointments.length} agendamentos`);
        
        // Buscar profiles dos usuários em uma query separada (mais confiável)
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
              console.warn('⚠️ [PROFILES-ERROR] Erro ao buscar perfis via RPC, continuando sem nomes:', profilesError.message);
            } else if (profiles && profiles.length > 0) {
              console.log(`✅ [PROFILES-SUCCESS] ${profiles.length} perfis carregados via SECURITY DEFINER`);
              profilesMap = profiles.reduce((acc, profile) => {
                acc[profile.user_id] = profile;
                return acc;
              }, {} as Record<string, any>);
            } else {
              console.log('ℹ️ [PROFILES-EMPTY] Nenhum perfil retornado pela função RPC');
            }
          } catch (err) {
            console.warn('⚠️ [PROFILES-CATCH] Falha ao buscar perfis via RPC, continuando sem nomes:', err);
          }
        }
        
        // Transformar dados
        console.log(`🔄 [TRANSFORM] Transformando ${allAppointments.length} agendamentos...`);
        
        const transformedAppointments: AppointmentWithRelations[] = allAppointments.map((apt: any, index: number) => {
          const criadoPorProfile = apt.criado_por_user_id ? profilesMap[apt.criado_por_user_id] || null : null;
          const alteradoPorProfile = apt.alterado_por_user_id ? profilesMap[apt.alterado_por_user_id] || null : null;
          
          // Debug: Log dos primeiros 3 agendamentos
          if (index < 3) {
            console.log(`🔍 [TRANSFORM-${index}] Agendamento ${apt.id.substring(0, 8)}:`, {
              criado_por: apt.criado_por,
              criado_por_user_id: apt.criado_por_user_id,
              profile_nome: criadoPorProfile?.nome || 'sem profile'
            });
          }
          
          return {
            ...apt,
            pacientes: apt.pacientes || null,
            medicos: apt.medicos || null,
            atendimentos: apt.atendimentos || null,
            criado_por_profile: criadoPorProfile,
            alterado_por_profile: alteradoPorProfile,
          };
        });
        
        // Análise por status
        const statusCount = transformedAppointments.reduce((acc, apt) => {
          acc[apt.status] = (acc[apt.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        console.log('📊 [STATUS] Distribuição:', statusCount);
        
        // Log final de verificação
        console.log(`✅ [FETCH-${executionId}] ========== BUSCA FINALIZADA ==========`);
        console.log(`📦 [FETCH-${executionId}] Total retornado: ${transformedAppointments.length} agendamentos`);
        
        // Verificar se os primeiros 3 têm profile
        const primeiros3 = transformedAppointments.slice(0, 3);
        console.log(`🔍 [VERIFICAÇÃO] Primeiros 3 agendamentos com profile:`, primeiros3.map(a => ({
          id: a.id.substring(0, 8),
          criado_por: a.criado_por,
          criado_por_user_id: a.criado_por_user_id,
          tem_profile: !!a.criado_por_profile,
          profile_nome: a.criado_por_profile?.nome
        })));

        logger.info('Agendamentos carregados com sucesso via paginação manual', { 
          count: transformedAppointments.length,
          total: totalCount,
          paginas: currentPage
        }, 'APPOINTMENTS');

        return transformedAppointments;
      } catch (err) {
        console.error('❌ [FETCH] Erro fatal:', err);
        logger.error('Erro ao buscar agendamentos', err, 'APPOINTMENTS');
        throw err;
      }
    }, 'fetch_appointments', 'GET').finally(() => {
      // Limpar após 30s
      setTimeout(() => {
        fetchPromiseRef.current = null;
        console.log('🧹 [CACHE] Cache local limpo');
      }, CACHE_DURATION);
    });
    
    return fetchPromiseRef.current;
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

  // 🔄 Invalidar cache local quando necessário
  const invalidateCache = useCallback(() => {
    console.log('🗑️ Invalidando cache local');
    fetchPromiseRef.current = null;
    fetchTimestampRef.current = 0;
  }, []);

  const forceRefetch = useCallback(() => {
    invalidateCache();
    refetch();
  }, [invalidateCache, refetch]);

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

  // 🔄 Debounced refetch para Realtime
  const debouncedRefetch = useCallback(() => {
    if (refetchDebounceRef.current) {
      clearTimeout(refetchDebounceRef.current);
    }
    
    refetchDebounceRef.current = setTimeout(() => {
      console.log('🔄 [REALTIME-DEBOUNCED] Refetching após 3s...');
      refetch();
    }, 3000);
  }, [refetch]);

  // Realtime updates com debounce
  useRealtimeUpdates({
    table: 'agendamentos',
    onInsert: (payload) => {
      if (isOperatingRef.current) return;
      console.log('🔄 [REALTIME] Novo agendamento inserido - aguardando 3s');
      debouncedRefetch();
      toast({
        title: "Novo agendamento",
        description: "Um novo agendamento foi criado!",
      });
    },
    onUpdate: (payload) => {
      if (isOperatingRef.current) return;
      console.log('🔄 [REALTIME] Agendamento atualizado - aguardando 3s');
      debouncedRefetch();
    },
    onDelete: (payload) => {
      if (isOperatingRef.current) return;
      console.log('🔄 [REALTIME] Agendamento deletado - aguardando 3s');
      debouncedRefetch();
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

      toast({ title: 'Agendamento confirmado', description: 'O agendamento foi confirmado com sucesso' });
      await refetch();
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
          p_alterado_por: profile?.nome || 'Usuário',
          p_alterado_por_user_id: profile?.user_id || null
        });

        if (error) throw error;
        if (!(data as any)?.success) throw new Error((data as any)?.error || 'Erro ao desconfirmar');
        return data;
      }, 'unconfirm_appointment', 'PUT');

      toast({ title: 'Confirmação removida', description: 'A confirmação do agendamento foi removida' });
      await refetch();
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
      }, 'delete_appointment', 'DELETE');

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
    appointments,
    loading,
    cancelAppointment,
    confirmAppointment,
    unconfirmAppointment,
    deleteAppointment,
    getAppointmentsByDoctorAndDate,
    refetch,
    invalidateCache,
    forceRefetch,
    pagination,
    error,
  };
}
