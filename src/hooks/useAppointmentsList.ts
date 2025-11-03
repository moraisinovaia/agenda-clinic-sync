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
const CACHE_DURATION = 120000; // ⚡ FASE 4: 2 minutos (era 30s)

// 🔄 QUERY DIRETA: Versão Otimizada 2025-10-27-17:00 - Solução definitiva com índices
export function useAppointmentsList(itemsPerPage: number = 20) {
  console.log('🏁 useAppointmentsList: Hook inicializado (Paginação Manual + Cache Local)');
  
  const { toast } = useToast();
  const { measureApiCall } = usePerformanceMetrics();
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastErrorRef = useRef<string | null>(null);
  const isOperatingRef = useRef(false);
  const refetchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const isPausedRef = useRef(false); // ✅ FASE 2: Flag para pausar polling
  
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
        // ⚡ FASE 1.1: Reduzir de 3 para 1 mês (era -3)
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 1);
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
          
          // ⚡ FASE 1.2: Reduzir limite de 5 para 2 páginas (era 5)
          if (currentPage >= 2) {
            console.warn('⚠️ Limite: 2 páginas (2000 registros)');
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
      console.log('🔄 [REALTIME-DEBOUNCED] Refetching após 500ms...');
      refetch();
    }, 500); // ⚡ FASE 2: Reduzido de 3000ms para 500ms
  }, [refetch]);

  // Realtime updates com debounce
  useRealtimeUpdates({
    table: 'agendamentos',
    onInsert: (payload) => {
      if (isOperatingRef.current || isPausedRef.current) {
        console.log('⏸️ [REALTIME] Insert ignorado - operação em andamento');
        return;
      }
      
      // ⚡ FASE 3: Update Local Otimista (aparece instantaneamente)
      const newAppointment = payload.new as AppointmentWithRelations;
      setAppointments(prev => [newAppointment, ...prev]);
      console.log('⚡ [REALTIME-INSTANT] Novo agendamento inserido localmente');
      
      // Refetch completo em background após 5s para garantir dados corretos
      setTimeout(() => {
        console.log('🔄 [BACKGROUND] Refetch completo após insert...');
        refetch();
      }, 5000);
    },
    onUpdate: (payload) => {
      if (isOperatingRef.current || isPausedRef.current) {
        console.log('⏸️ [REALTIME] Update ignorado - operação em andamento');
        return;
      }
      console.log('🔄 [REALTIME] Agendamento atualizado - aguardando 3s');
      debouncedRefetch();
    },
    onDelete: (payload) => {
      if (isOperatingRef.current || isPausedRef.current) {
        console.log('⏸️ [REALTIME] Delete ignorado - operação em andamento');
        return;
      }
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

  // ✅ FASE 2: Helper para retry com backoff exponencial
  const retryOperation = async <T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    delayMs = 1000
  ): Promise<T> => {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [RETRY] Tentativa ${attempt}/${maxRetries}`);
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ [RETRY] Tentativa ${attempt}/${maxRetries} falhou:`, error);
        
        if (attempt < maxRetries) {
          const waitTime = delayMs * attempt; // Backoff exponencial simples
          console.log(`⏳ [RETRY] Aguardando ${waitTime}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    console.error(`❌ [RETRY] Todas as ${maxRetries} tentativas falhararam`);
    throw lastError;
  };

  const cancelAppointment = async (appointmentId: string) => {
    isOperatingRef.current = true;
    try {
      // ✅ FASE 2: Aplicar retry automático
      await retryOperation(async () => {
        await measureApiCall(async () => {
          const { data: profile } = await supabase
            .rpc('get_current_user_profile');

          const { data, error } = await supabase.rpc('cancelar_agendamento_soft', {
            p_agendamento_id: appointmentId,
            p_cancelado_por: profile?.[0]?.nome || 'Usuário',
            p_cancelado_por_user_id: profile?.[0]?.user_id || null
          });

          if (error) throw error;
          if (!(data as any)?.success) throw new Error((data as any)?.error || 'Erro ao cancelar');
          return data;
        }, 'cancel_appointment', 'PUT');
      });

      toast({ 
        title: 'Agendamento cancelado', 
        description: 'O agendamento foi cancelado com sucesso' 
      });
      
      // ✅ FASE 2: Aguardar 500ms antes de refetch para evitar race condition
      await new Promise(resolve => setTimeout(resolve, 500));
      await refetch();
    } catch (error) {
      console.error('❌ [CANCEL] Erro após todas as tentativas:', error);
      toast({
        title: 'Erro ao cancelar',
        description: error instanceof Error ? error.message : 'Não foi possível cancelar',
        variant: 'destructive',
      });
      throw error;
    } finally {
      // ✅ FASE 2: GARANTIR que flag seja resetada
      isOperatingRef.current = false;
    }
  };

  const confirmAppointment = async (appointmentId: string) => {
    // ✅ FASE 1: Logs detalhados
    console.log('🎯 [CONFIRM] Iniciando confirmação:', {
      appointmentId,
      timestamp: new Date().toISOString(),
      isOperating: isOperatingRef.current,
      isPaused: isPausedRef.current
    });
    
    // ✅ FASE 2: Pausar polling
    isPausedRef.current = true;
    isOperatingRef.current = true;
    
    try {
      // ✅ FASE 1: Verificar se o agendamento existe na lista atual
      const appointment = appointments.find(apt => apt.id === appointmentId);
      console.log('📋 [CONFIRM] Agendamento encontrado na lista:', {
        found: !!appointment,
        status: appointment?.status,
        paciente: appointment?.pacientes?.nome_completo
      });
      
      // ✅ FASE 3: Validar status ANTES de enviar RPC
      console.log('🔍 [CONFIRM] Buscando agendamento atualizado no banco...');
      const { data: currentAppointment, error: fetchError } = await supabase
        .from('agendamentos')
        .select('id, status, pacientes(nome_completo)')
        .eq('id', appointmentId)
        .single();
      
      if (fetchError || !currentAppointment) {
        console.error('❌ [CONFIRM] Agendamento não encontrado no banco:', fetchError);
        throw new Error('Agendamento não encontrado no banco de dados');
      }
      
      if (currentAppointment.status !== 'agendado' && currentAppointment.status !== 'cancelado_bloqueio') {
        console.error('❌ [CONFIRM] Status inválido:', currentAppointment.status);
        throw new Error(`Agendamento está com status "${currentAppointment.status}" e não pode ser confirmado`);
      }
      
      console.log('✅ [CONFIRM] Agendamento validado:', currentAppointment);
      
      // ✅ FASE 2: Aplicar retry automático após validação
      await retryOperation(async () => {
        await measureApiCall(async () => {
          const { data: profile } = await supabase
            .rpc('get_current_user_profile');

          const { data, error } = await supabase.rpc('confirmar_agendamento', {
            p_agendamento_id: appointmentId,
            p_confirmado_por: profile?.[0]?.nome || 'Usuário',
            p_confirmado_por_user_id: profile?.[0]?.user_id || null
          });

          if (error) throw error;
          if (!(data as any)?.success) throw new Error((data as any)?.error || 'Erro ao confirmar');
          return data;
        }, 'confirm_appointment', 'PUT');
      });

      toast({ 
        title: 'Agendamento confirmado', 
        description: 'O agendamento foi confirmado com sucesso' 
      });
      
      // Aguardar antes de refetch
      await new Promise(resolve => setTimeout(resolve, 500));
      await refetch();
      
    } catch (error) {
      console.error('❌ [CONFIRM] Erro após validações:', error);
      
      // ✅ FASE 4: Feedback específico baseado no erro
      let errorMessage = 'Erro ao confirmar agendamento';
      let errorDescription = 'Tente novamente';
      
      if (error instanceof Error) {
        if (error.message.includes('não encontrado')) {
          errorDescription = 'O agendamento não foi encontrado. A lista será atualizada.';
          // Forçar refetch imediato
          await refetch();
        } else if (error.message.includes('status')) {
          errorDescription = error.message;
        } else {
          errorDescription = error.message;
        }
      }
      
      toast({
        title: errorMessage,
        description: errorDescription,
        variant: 'destructive',
      });
      throw error;
      
    } finally {
      isOperatingRef.current = false;
      // ✅ FASE 2: Retomar polling após 2s
      setTimeout(() => {
        isPausedRef.current = false;
        console.log('▶️ [CONFIRM] Polling retomado');
      }, 2000);
    }
  };

  const unconfirmAppointment = async (appointmentId: string) => {
    isOperatingRef.current = true;
    try {
      // ✅ FASE 2: Aplicar retry automático
      await retryOperation(async () => {
        await measureApiCall(async () => {
          const { data: profile } = await supabase
            .rpc('get_current_user_profile');

          const { data, error } = await supabase.rpc('desconfirmar_agendamento', {
            p_agendamento_id: appointmentId,
            p_desconfirmado_por: profile?.[0]?.nome || 'Usuário',
            p_desconfirmado_por_user_id: profile?.[0]?.user_id || null
          });

          if (error) throw error;
          if (!(data as any)?.success) throw new Error((data as any)?.error || 'Erro ao desconfirmar');
          return data;
        }, 'unconfirm_appointment', 'PUT');
      });

      toast({ 
        title: 'Confirmação removida', 
        description: 'A confirmação do agendamento foi removida' 
      });
      
      // ✅ FASE 2: Aguardar 500ms antes de refetch para evitar race condition
      await new Promise(resolve => setTimeout(resolve, 500));
      await refetch();
    } catch (error) {
      console.error('❌ [UNCONFIRM] Erro após todas as tentativas:', error);
      toast({
        title: 'Erro ao desconfirmar',
        description: error instanceof Error ? error.message : 'Não foi possível desconfirmar',
        variant: 'destructive',
      });
      throw error;
    } finally {
      // ✅ FASE 2: GARANTIR que flag seja resetada
      isOperatingRef.current = false;
    }
  };

  const deleteAppointment = async (appointmentId: string) => {
    isOperatingRef.current = true;
    try {
      // ✅ FASE 2: Aplicar retry automático
      await retryOperation(async () => {
        await measureApiCall(async () => {
          const { data: profile } = await supabase
            .rpc('get_current_user_profile');

          const { data, error } = await supabase.rpc('excluir_agendamento_soft', {
            p_agendamento_id: appointmentId,
            p_excluido_por: profile?.[0]?.nome || 'Usuário',
            p_excluido_por_user_id: profile?.[0]?.user_id || null
          });

          if (error) throw error;
          if (!(data as any)?.success) throw new Error((data as any)?.error || 'Erro ao excluir');
          return data;
        }, 'delete_appointment', 'DELETE');
      });

      toast({ 
        title: 'Agendamento excluído', 
        description: 'O agendamento foi excluído com sucesso' 
      });
      
      // ✅ FASE 2: Aguardar 500ms antes de refetch para evitar race condition
      await new Promise(resolve => setTimeout(resolve, 500));
      await refetch();
    } catch (error) {
      console.error('❌ [DELETE] Erro após todas as tentativas:', error);
      toast({
        title: 'Erro ao excluir',
        description: error instanceof Error ? error.message : 'Não foi possível excluir',
        variant: 'destructive',
      });
      throw error;
    } finally {
      // ✅ FASE 2: GARANTIR que flag seja resetada
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
