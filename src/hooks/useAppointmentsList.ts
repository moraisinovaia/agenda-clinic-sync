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
  const isPausedRef = useRef(false);
  
  // 🚨 OTIMIZAÇÃO FASE 2: Cache local por instância usando refs
  const fetchPromiseRef = useRef<Promise<AppointmentWithRelations[]> | null>(null);
  const fetchTimestampRef = useRef<number>(0);
  
  // ⚡ OTIMIZAÇÃO: Cache de perfil de usuário para evitar RPC repetidos
  const userProfileRef = useRef<{ nome: string; user_id: string } | null>(null);
  
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
        // 🔥 SEM FILTRO DE DATA - Carregar TODOS os agendamentos
        console.log('📅 [FILTRO] Buscando TODOS os agendamentos (sem filtro de data)');
        
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
          
          // ✅ Aumentado para 10 páginas (10.000 registros) para garantir todos os dados
          if (currentPage >= 10) {
            console.warn('⚠️ Limite: 10 páginas (10.000 registros)');
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

  // ⚡ OTIMIZAÇÃO: Buscar perfil uma única vez e cachear
  const getUserProfile = useCallback(async () => {
    if (userProfileRef.current) {
      console.log('♻️ [PROFILE-CACHE] Usando perfil cacheado:', userProfileRef.current);
      return userProfileRef.current;
    }
    
    console.log('🔍 [PROFILE] Buscando perfil do usuário...');
    const { data: profile } = await supabase.rpc('get_current_user_profile');
    userProfileRef.current = {
      nome: profile?.[0]?.nome || 'Usuário',
      user_id: profile?.[0]?.user_id || null
    };
    console.log('✅ [PROFILE] Perfil cacheado:', userProfileRef.current);
    return userProfileRef.current;
  }, []);

  // ⚡ OTIMIZAÇÃO: Atualização local otimista para feedback instantâneo
  const updateLocalAppointment = useCallback((appointmentId: string, updates: Partial<AppointmentWithRelations>) => {
    console.log('⚡ [LOCAL-UPDATE] Iniciando:', { 
      id: appointmentId.substring(0, 8), 
      updates 
    });
    
    setAppointments(prev => {
      console.log('📋 [LOCAL-UPDATE] Total appointments:', prev.length);
      
      const oldAppointment = prev.find(apt => apt.id === appointmentId);
      console.log('🔍 [LOCAL-UPDATE] Encontrado?', !!oldAppointment);
      
      if (oldAppointment) {
        console.log('📊 [LOCAL-UPDATE] Status ANTES:', oldAppointment.status);
        console.log('📊 [LOCAL-UPDATE] Status DEPOIS:', updates.status || oldAppointment.status);
      }
      
      const updated = prev.map(apt => 
        apt.id === appointmentId ? { ...apt, ...updates } : apt
      );
      
      const newAppointment = updated.find(apt => apt.id === appointmentId);
      console.log('✅ [LOCAL-UPDATE] Novo status confirmado:', newAppointment?.status);
      console.log('🔄 [LOCAL-UPDATE] Array reference mudou?', prev !== updated);
      
      return updated;
    });
  }, []);

  // ✅ RETRY AUTOMÁTICO com exponential backoff
  const retryOperation = async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> => {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [RETRY] Tentativa ${attempt}/${maxRetries}`);
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ [RETRY] Tentativa ${attempt} falhou:`, error);
        
        if (attempt < maxRetries) {
          const backoffDelay = delayMs * Math.pow(2, attempt - 1);
          console.log(`⏳ [RETRY] Aguardando ${backoffDelay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
    }
    
    console.error(`❌ [RETRY] Todas as ${maxRetries} tentativas falharam`);
    throw lastError || new Error('Operação falhou após múltiplas tentativas');
  };

  // ✅ TIMEOUT PROTECTION
  const withTimeout = <T>(
    promise: Promise<T>,
    timeoutMs: number = 15000
  ): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operação expirou (timeout)')), timeoutMs)
      )
    ]);
  };

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

  const cancelAppointment = async (appointmentId: string) => {
    console.log('🎯 [CANCEL] Iniciando cancelamento:', appointmentId);
    
    if (isOperatingRef.current) {
      console.warn('⚠️ [CANCEL] Operação já em andamento');
      return;
    }
    
    isOperatingRef.current = true;
    isPausedRef.current = true;
    
    try {
      const profile = await getUserProfile();
      
      console.log('🔍 [CANCEL] Verificando status no banco...');
      const { data: currentAppointment, error: fetchError } = await withTimeout(
        (async () => {
          return await supabase
            .from('agendamentos')
            .select('status, pacientes(nome_completo)')
            .eq('id', appointmentId)
            .is('excluido_em', null)
            .single();
        })(),
        15000 // Aumentado de 8000 para 15000ms
      );
      
      if (fetchError) {
        console.error('❌ [CANCEL] Erro ao buscar:', fetchError);
        throw new Error('Agendamento não encontrado');
      }
      
      if (currentAppointment.status === 'cancelado') {
        toast({
          title: 'Já cancelado',
          description: 'Este agendamento já foi cancelado.',
          variant: 'default',
        });
        await refetch();
        return;
      }
      
      console.log('🔄 [CANCEL] Executando RPC...');
      const response = await retryOperation(async () => {
        return await withTimeout(
          (async () => {
            return await supabase.rpc('cancelar_agendamento_soft', {
              p_agendamento_id: appointmentId,
              p_cancelado_por: profile.nome,
              p_cancelado_por_user_id: profile.user_id
            });
          })(),
          20000 // Aumentado de 10000 para 20000ms
        );
      }, 5); // Aumentado de 3 para 5 tentativas

      if (response.error) {
        throw response.error;
      }
      
      const result = response.data;
      const resultAny = result as any;
      const isSuccess = resultAny?.success === undefined || resultAny?.success === null
        ? true
        : !!resultAny.success;

      if (!isSuccess) {
        throw new Error(resultAny?.error || resultAny?.message || 'Falha ao cancelar');
      }
      
      updateLocalAppointment(appointmentId, { 
        status: 'cancelado',
        cancelado_em: new Date().toISOString(),
        cancelado_por: profile.nome,
        cancelado_por_user_id: profile.user_id
      });
      
      toast({ 
        title: 'Cancelado com sucesso', 
        description: 'O agendamento foi cancelado' 
      });
      
      setTimeout(() => {
        if (!isOperatingRef.current) {
          console.log('🔄 [BACKGROUND-CANCEL] Executando refetch de validação...');
          invalidateCache();
          refetch();
        } else {
          console.warn('⚠️ [BACKGROUND-CANCEL] Refetch cancelado - operação em andamento');
        }
      }, 2000);
      
    } catch (error) {
      console.error('❌ [CANCEL] Erro detalhado:', {
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: error instanceof Error ? error.stack : undefined,
        appointmentId,
        timestamp: new Date().toISOString()
      });
      
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      let userMessage = 'Tente novamente';
      
      if (errorMsg.includes('não encontrado')) {
        userMessage = 'Agendamento não encontrado';
      } else if (errorMsg.includes('timeout') || errorMsg.includes('expirou')) {
        userMessage = 'A operação demorou muito. Verifique sua conexão com a internet.';
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
        userMessage = 'Problema de conexão. Verifique sua internet e tente novamente.';
      } else if (errorMsg.includes('permission') || errorMsg.includes('denied')) {
        userMessage = 'Você não tem permissão para cancelar este agendamento.';
      } else if (errorMsg.length > 0 && errorMsg !== 'Erro desconhecido') {
        userMessage = `Erro: ${errorMsg.substring(0, 80)}${errorMsg.length > 80 ? '...' : ''}`;
      }
      
      toast({
        title: 'Erro ao cancelar',
        description: userMessage,
        variant: 'destructive',
      });
      
      await refetch();
      
    } finally {
      isOperatingRef.current = false;
      isPausedRef.current = false;
    }
  };

  const confirmAppointment = async (appointmentId: string) => {
    console.log('🎯 [CONFIRM] Iniciando confirmação:', appointmentId);
    
    if (isOperatingRef.current) {
      console.warn('⚠️ [CONFIRM] Operação já em andamento');
      return;
    }
    
    isOperatingRef.current = true;
    isPausedRef.current = true;
    
    try {
      const profile = await getUserProfile();
      
      console.log('🔍 [CONFIRM] Verificando status no banco...');
      const { data: currentAppointment, error: fetchError } = await withTimeout(
        (async () => {
          return await supabase
            .from('agendamentos')
            .select('status, pacientes(nome_completo)')
            .eq('id', appointmentId)
            .is('excluido_em', null)
            .single();
        })(),
        15000 // Aumentado de 8000 para 15000ms
      );
      
      if (fetchError) {
        throw new Error('Agendamento não encontrado');
      }
      
      if (currentAppointment.status === 'confirmado') {
        toast({
          title: 'Já confirmado',
          description: 'Este agendamento já está confirmado.',
          variant: 'default',
        });
        await refetch();
        return;
      }
      
      if (currentAppointment.status !== 'agendado' && currentAppointment.status !== 'cancelado_bloqueio') {
        toast({
          title: 'Ação não permitida',
          description: `Agendamentos com status "${currentAppointment.status}" não podem ser confirmados.`,
          variant: 'destructive',
        });
        await refetch();
        return;
      }
      
      console.log('🔄 [CONFIRM] Executando RPC...');
      const response = await retryOperation(async () => {
        return await withTimeout(
          (async () => {
            return await supabase.rpc('confirmar_agendamento', {
              p_agendamento_id: appointmentId,
              p_confirmado_por: profile.nome,
              p_confirmado_por_user_id: profile.user_id
            });
          })(),
          20000 // Aumentado de 10000 para 20000ms
        );
      }, 5); // Aumentado de 3 para 5 tentativas

      if (response.error) {
        throw response.error;
      }
      
      const result = response.data;
      const resultAny = result as any;
      const isSuccess = resultAny?.success === undefined || resultAny?.success === null
        ? true
        : !!resultAny.success;

      if (!isSuccess) {
        throw new Error(resultAny?.error || resultAny?.message || 'Falha ao confirmar');
      }
      
      updateLocalAppointment(appointmentId, { 
        status: 'confirmado',
        confirmado_em: new Date().toISOString(),
        confirmado_por: profile.nome,
        confirmado_por_user_id: profile.user_id
      });
      
      toast({ 
        title: 'Confirmado com sucesso', 
        description: 'O agendamento foi confirmado' 
      });
      
      setTimeout(() => {
        if (!isOperatingRef.current) {
          console.log('🔄 [BACKGROUND-CONFIRM] Executando refetch de validação...');
          invalidateCache();
          refetch();
        } else {
          console.warn('⚠️ [BACKGROUND-CONFIRM] Refetch cancelado - operação em andamento');
        }
      }, 2000);
      
    } catch (error) {
      console.error('❌ [CONFIRM] Erro detalhado:', {
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: error instanceof Error ? error.stack : undefined,
        appointmentId,
        timestamp: new Date().toISOString()
      });
      
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      let userMessage = 'Tente novamente';
      
      if (errorMsg.includes('não encontrado')) {
        userMessage = 'Agendamento não encontrado';
      } else if (errorMsg.includes('timeout') || errorMsg.includes('expirou')) {
        userMessage = 'A operação demorou muito. Verifique sua conexão com a internet.';
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
        userMessage = 'Problema de conexão. Verifique sua internet e tente novamente.';
      } else if (errorMsg.includes('permission') || errorMsg.includes('denied')) {
        userMessage = 'Você não tem permissão para confirmar este agendamento.';
      } else if (errorMsg.length > 0 && errorMsg !== 'Erro desconhecido') {
        userMessage = `Erro: ${errorMsg.substring(0, 80)}${errorMsg.length > 80 ? '...' : ''}`;
      }
      
      toast({
        title: 'Erro ao confirmar',
        description: userMessage,
        variant: 'destructive',
      });
      
      await refetch();
      
    } finally {
      isOperatingRef.current = false;
      isPausedRef.current = false;
    }
  };

  const unconfirmAppointment = async (appointmentId: string) => {
    console.log('🎯 [UNCONFIRM] Iniciando desconfirmação:', appointmentId);
    
    if (isOperatingRef.current) {
      console.warn('⚠️ [UNCONFIRM] Operação já em andamento');
      return;
    }
    
    isOperatingRef.current = true;
    isPausedRef.current = true;
    
    try {
      const profile = await getUserProfile();
      
      console.log('🔍 [UNCONFIRM] Verificando status no banco...');
      const { data: currentAppointment, error: fetchError } = await withTimeout(
        (async () => {
          return await supabase
            .from('agendamentos')
            .select('status, pacientes(nome_completo)')
            .eq('id', appointmentId)
            .is('excluido_em', null)
            .single();
        })(),
        8000
      );
      
      if (fetchError) {
        throw new Error('Agendamento não encontrado');
      }
      
      if (currentAppointment.status === 'agendado') {
        toast({
          title: 'Sem confirmação',
          description: 'Este agendamento já está sem confirmação.',
          variant: 'default',
        });
        await refetch();
        return;
      }
      
      if (currentAppointment.status !== 'confirmado') {
        let userMessage = '';
        if (currentAppointment.status === 'cancelado') {
          userMessage = 'Agendamentos cancelados não podem ser desconfirmados.';
        } else {
          userMessage = `Agendamentos com status "${currentAppointment.status}" não podem ser desconfirmados.`;
        }
        
        toast({
          title: 'Ação não permitida',
          description: userMessage,
          variant: 'destructive',
        });
        await refetch();
        return;
      }
      
      console.log('🔄 [UNCONFIRM] Executando RPC...');
      const response = await retryOperation(async () => {
        return await withTimeout(
          (async () => {
            return await supabase.rpc('desconfirmar_agendamento', {
              p_agendamento_id: appointmentId,
              p_desconfirmado_por: profile.nome,
              p_desconfirmado_por_user_id: profile.user_id
            });
          })(),
          10000
        );
      });

      if (response.error) {
        throw response.error;
      }
      
      const result = response.data;
      const resultAny = result as any;
      const isSuccess = resultAny?.success === undefined || resultAny?.success === null
        ? true
        : !!resultAny.success;

      if (!isSuccess) {
        throw new Error(resultAny?.error || resultAny?.message || 'Falha ao desconfirmar');
      }
      
      updateLocalAppointment(appointmentId, { 
        status: 'agendado',
        confirmado_em: null,
        confirmado_por: null,
        confirmado_por_user_id: null
      });
      
      toast({ 
        title: 'Confirmação removida', 
        description: 'A confirmação do agendamento foi removida' 
      });
      
      setTimeout(() => {
        if (!isOperatingRef.current) {
          console.log('🔄 [BACKGROUND-UNCONFIRM] Executando refetch de validação...');
          invalidateCache();
          refetch();
        } else {
          console.warn('⚠️ [BACKGROUND-UNCONFIRM] Refetch cancelado - operação em andamento');
        }
      }, 2000);
      
    } catch (error) {
      console.error('❌ [UNCONFIRM] Erro:', error);
      
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      let userMessage = 'Tente novamente';
      
      if (errorMsg.includes('não encontrado')) {
        userMessage = 'Agendamento não encontrado';
      } else if (errorMsg.includes('timeout') || errorMsg.includes('expirou')) {
        userMessage = 'Operação demorou demais. Verifique sua conexão.';
      }
      
      toast({
        title: 'Erro ao desconfirmar',
        description: userMessage,
        variant: 'destructive',
      });
      
      await refetch();
      
    } finally {
      isOperatingRef.current = false;
      isPausedRef.current = false;
    }
  };

  const deleteAppointment = async (appointmentId: string) => {
    console.log('🎯 [DELETE] Iniciando exclusão:', appointmentId);
    
    if (isOperatingRef.current) {
      console.warn('⚠️ [DELETE] Operação já em andamento');
      return;
    }
    
    isOperatingRef.current = true;
    isPausedRef.current = true;
    
    try {
      const profile = await getUserProfile();
      
      console.log('🔄 [DELETE] Executando RPC...');
      const response = await retryOperation(async () => {
        return await withTimeout(
          (async () => {
            return await supabase.rpc('excluir_agendamento_soft', {
              p_agendamento_id: appointmentId,
              p_excluido_por: profile.nome,
              p_excluido_por_user_id: profile.user_id
            });
          })(),
          10000
        );
      });

      if (response.error) {
        throw response.error;
      }
      
      const result = response.data;
      const resultAny = result as any;
      const isSuccess = resultAny?.success === undefined || resultAny?.success === null
        ? true
        : !!resultAny.success;

      if (!isSuccess) {
        throw new Error(resultAny?.error || resultAny?.message || 'Falha ao excluir');
      }
      
      setAppointments(prev => prev.filter(apt => apt.id !== appointmentId));
      
      toast({ 
        title: 'Excluído com sucesso', 
        description: 'O agendamento foi excluído' 
      });
      
      setTimeout(() => {
        if (!isOperatingRef.current) {
          console.log('🔄 [BACKGROUND-DELETE] Executando refetch de validação...');
          invalidateCache();
          refetch();
        } else {
          console.warn('⚠️ [BACKGROUND-DELETE] Refetch cancelado - operação em andamento');
        }
      }, 2000);
      
    } catch (error) {
      console.error('❌ [DELETE] Erro:', error);
      
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      let userMessage = 'Não foi possível excluir';
      
      if (errorMsg.includes('não encontrado')) {
        userMessage = 'Agendamento não encontrado';
      } else if (errorMsg.includes('timeout') || errorMsg.includes('expirou')) {
        userMessage = 'Operação demorou demais. Verifique sua conexão.';
      }
      
      toast({
        title: 'Erro ao excluir',
        description: userMessage,
        variant: 'destructive',
      });
      
      await refetch();
      
    } finally {
      isOperatingRef.current = false;
      isPausedRef.current = false;
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
