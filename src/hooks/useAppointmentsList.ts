import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppointmentWithRelations } from '@/types/scheduling';
import { useToast } from '@/hooks/use-toast';
import { usePagination } from '@/hooks/usePagination';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { useDebounce } from '@/hooks/useDebounce';
import { logger } from '@/utils/logger';

// 🚨 OTIMIZAÇÃO FASE 8: Cache aumentado + Update otimista para feedback instantâneo
// Realtime + update otimista compensam o cache maior
const CACHE_DURATION = 30000; // ⚡ FASE 8: 30 segundos - update otimista garante feedback rápido

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
  
  // 🔥 Refs para detectar mudanças no polling
  const lastKnownTimestampRef = useRef<string | null>(null);
  const lastKnownCountRef = useRef<number | null>(null); // ✅ v7: count-based detection
  const lastKnownIdRef = useRef<string | null>(null);
  
  // 🔥 Estado local para appointments
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // ⚡ OTIMIZAÇÃO FASE 9: Usar RPC get_agendamentos_completos para busca única
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
    console.log(`🚀 [FETCH-${executionId}] ========== INÍCIO DA BUSCA OTIMIZADA (RPC) ==========`);
    fetchTimestampRef.current = now;
    
    fetchPromiseRef.current = measureApiCall(async () => {
      try {
        console.log('📦 [RPC] Chamando get_agendamentos_completos...');
        const startTime = performance.now();
        
        // ⚡ Uma única chamada RPC que retorna tudo (agendamentos + pacientes + médicos + atendimentos + profiles)
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_agendamentos_completos', {
          p_cliente_id: null, // null = todos os clientes (admin global)
          p_limit: 10000
        });
        
        const rpcTime = performance.now() - startTime;
        console.log(`⏱️ [RPC] Tempo de execução: ${rpcTime.toFixed(0)}ms`);
        
        if (rpcError) {
          console.warn('⚠️ [RPC] Erro na RPC otimizada, tentando fallback...', rpcError);
          // Fallback para o método antigo em caso de erro
          return await fetchAppointmentsFallback();
        }
        
        if (!rpcData || rpcData.length === 0) {
          console.log('📭 [RPC] Nenhum agendamento retornado');
          return [];
        }
        
        console.log(`✅ [RPC] ${rpcData.length} agendamentos carregados em uma única chamada`);
        
        // Transformar dados da RPC para o formato esperado (cast as any para flexibilidade)
        const transformedAppointments = rpcData.map((row: any) => ({
          id: row.id,
          paciente_id: row.paciente_id,
          medico_id: row.medico_id,
          atendimento_id: row.atendimento_id,
          data_agendamento: row.data_agendamento,
          hora_agendamento: row.hora_agendamento,
          status: row.status,
          convenio: row.convenio,
          observacoes: row.observacoes,
          criado_por: row.criado_por,
          criado_por_user_id: row.criado_por_user_id,
          alterado_por_user_id: row.alterado_por_user_id,
          cancelado_por: row.cancelado_por,
          cancelado_por_user_id: row.cancelado_por_user_id,
          cancelado_em: row.cancelado_em,
          confirmado_por: row.confirmado_por,
          confirmado_por_user_id: row.confirmado_por_user_id,
          confirmado_em: row.confirmado_em,
          excluido_por: row.excluido_por,
          excluido_por_user_id: row.excluido_por_user_id,
          excluido_em: row.excluido_em,
          created_at: row.created_at,
          updated_at: row.updated_at,
          cliente_id: row.cliente_id,
          // Dados relacionados já embutidos - estrutura mínima necessária para UI
          pacientes: row.paciente_nome ? {
            id: row.paciente_id,
            nome_completo: row.paciente_nome,
            data_nascimento: row.paciente_data_nascimento,
            convenio: row.paciente_convenio,
            telefone: row.paciente_telefone,
            celular: row.paciente_celular,
            cliente_id: row.cliente_id,
            created_at: row.created_at,
            updated_at: row.updated_at
          } : null,
          medicos: row.medico_nome ? {
            id: row.medico_id,
            nome: row.medico_nome,
            especialidade: row.medico_especialidade,
            ativo: true
          } : null,
          atendimentos: row.atendimento_nome ? {
            id: row.atendimento_id,
            nome: row.atendimento_nome,
            tipo: row.atendimento_tipo
          } : null,
          criado_por_profile: row.criado_por_profile_nome ? {
            id: '',
            user_id: row.criado_por_user_id,
            nome: row.criado_por_profile_nome,
            email: row.criado_por_profile_email,
            ativo: true,
            created_at: '',
            updated_at: ''
          } : null,
          alterado_por_profile: row.alterado_por_profile_nome ? {
            id: '',
            user_id: row.alterado_por_user_id,
            nome: row.alterado_por_profile_nome,
            email: row.alterado_por_profile_email,
            ativo: true,
            created_at: '',
            updated_at: ''
          } : null
        })) as AppointmentWithRelations[];
        
        // Análise por status
        const statusCount = transformedAppointments.reduce((acc, apt) => {
          acc[apt.status] = (acc[apt.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        console.log('📊 [STATUS] Distribuição:', statusCount);
        console.log(`✅ [FETCH-${executionId}] ========== BUSCA OTIMIZADA FINALIZADA ==========`);
        
        logger.info('Agendamentos carregados via RPC otimizada', { 
          count: transformedAppointments.length,
          tempo_ms: rpcTime.toFixed(0)
        }, 'APPOINTMENTS');

        return transformedAppointments;
      } catch (err) {
        console.error('❌ [FETCH] Erro fatal:', err);
        logger.error('Erro ao buscar agendamentos', err, 'APPOINTMENTS');
        throw err;
      }
    }, 'fetch_appointments_rpc', 'GET').finally(() => {
      // Limpar cache após duração
      setTimeout(() => {
        fetchPromiseRef.current = null;
        console.log('🧹 [CACHE] Cache local limpo');
      }, CACHE_DURATION);
    });
    
    return fetchPromiseRef.current;
  }, [measureApiCall]);

  // 🔄 FALLBACK: Método antigo caso RPC falhe
  const fetchAppointmentsFallback = async (): Promise<AppointmentWithRelations[]> => {
    console.log('🔄 [FALLBACK] Usando método de paginação manual...');
    
    let allAppointments: any[] = [];
    let currentPage = 0;
    const pageSize = 1000;
    let hasMore = true;
    let totalCount = 0;
    
    while (hasMore) {
      const start = currentPage * pageSize;
      const end = start + pageSize - 1;
      
      const { data: pageData, error, count } = await supabase
        .from('agendamentos')
        .select(`
          *,
          pacientes!inner(id, nome_completo, convenio, celular, telefone, data_nascimento),
          medicos!inner(id, nome, especialidade, ativo),
          atendimentos!inner(id, nome, tipo, medico_id)
        `, { count: 'exact' })
        .is('excluido_em', null)
        .order('data_agendamento', { ascending: false })
        .order('hora_agendamento', { ascending: false })
        .range(start, end);
      
      if (error) throw error;
      if (count !== null && currentPage === 0) totalCount = count;
      if (!pageData || pageData.length === 0) break;
      
      allAppointments = [...allAppointments, ...pageData];
      currentPage++;
      
      if (allAppointments.length >= totalCount || currentPage >= 10) hasMore = false;
    }
    
    // Buscar profiles separadamente
    const userIds = new Set<string>();
    allAppointments.forEach((apt: any) => {
      if (apt.criado_por_user_id) userIds.add(apt.criado_por_user_id);
      if (apt.alterado_por_user_id) userIds.add(apt.alterado_por_user_id);
    });

    let profilesMap: Record<string, any> = {};
    if (userIds.size > 0) {
      const { data: profiles } = await supabase.rpc('get_user_profiles', { user_ids: Array.from(userIds) });
      if (profiles) {
        profilesMap = profiles.reduce((acc: any, p: any) => { acc[p.user_id] = p; return acc; }, {});
      }
    }
    
    return allAppointments.map((apt: any) => ({
      ...apt,
      pacientes: apt.pacientes || null,
      medicos: apt.medicos || null,
      atendimentos: apt.atendimentos || null,
      criado_por_profile: apt.criado_por_user_id ? profilesMap[apt.criado_por_user_id] || null : null,
      alterado_por_profile: apt.alterado_por_user_id ? profilesMap[apt.alterado_por_user_id] || null : null,
    }));
  };

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
  // ✅ CORREÇÃO v6: NÃO zerar lastKnownTimestampRef - isso quebrava a detecção de mudanças!
  const invalidateCache = useCallback(() => {
    console.log('🗑️ Invalidando cache local (mantendo refs de polling)');
    fetchPromiseRef.current = null;
    fetchTimestampRef.current = 0;
    // ❌ REMOVIDO: lastKnownTimestampRef.current = null; // Isso quebrava o polling!
    // ❌ REMOVIDO: lastKnownCountRef.current = null; // Manter para comparação
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

  // ⚡ OTIMIZAÇÃO FASE 8: Adicionar agendamento localmente para feedback instantâneo
  const addAppointmentLocally = useCallback((newAppointment: AppointmentWithRelations) => {
    console.log('⚡ [LOCAL-ADD] Adicionando agendamento instantaneamente:', newAppointment.id.substring(0, 8));
    setAppointments(prev => {
      // Verificar se já existe (evitar duplicatas)
      if (prev.some(apt => apt.id === newAppointment.id)) {
        console.log('⚠️ [LOCAL-ADD] Agendamento já existe, atualizando...');
        return prev.map(apt => apt.id === newAppointment.id ? newAppointment : apt);
      }
      // Adicionar no início (mais recente primeiro)
      console.log('✅ [LOCAL-ADD] Novo agendamento adicionado ao topo');
      return [newAppointment, ...prev];
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

  // ✅ FASE 7: Verificar mudanças por TIMESTAMP + COUNT (mais robusto para LLM appointments)
  const checkForNewAppointments = useCallback(async () => {
    try {
      // 🔥 OTIMIZAÇÃO: Buscar timestamp E count em uma única query
      const { data: latestData, count } = await supabase
        .from('agendamentos')
        .select('id, updated_at, created_at', { count: 'exact' })
        .is('excluido_em', null)
        .order('updated_at', { ascending: false })
        .limit(1);
      
      if (latestData && latestData.length > 0 && count !== null) {
        const latestTimestamp = latestData[0].updated_at;
        const latestCreatedAt = latestData[0].created_at;
        
        // ✅ CORREÇÃO v7: Detectar mudanças por TIMESTAMP OU COUNT
        const hasTimestampChange = latestTimestamp !== lastKnownTimestampRef.current;
        const hasCountChange = lastKnownCountRef.current !== null && count !== lastKnownCountRef.current;
        const hasChanges = hasTimestampChange || hasCountChange;
        
        // ✅ Debug detalhado para diagnóstico
        if (hasChanges && lastKnownTimestampRef.current !== null) {
          console.log('🆕 [POLLING v7] MUDANÇA DETECTADA!', { 
            tipoMudanca: hasCountChange ? 'NOVO AGENDAMENTO' : 'ATUALIZAÇÃO',
            newTimestamp: latestTimestamp,
            newCreatedAt: latestCreatedAt,
            previousTimestamp: lastKnownTimestampRef.current,
            newCount: count,
            previousCount: lastKnownCountRef.current,
            diff: count - (lastKnownCountRef.current || 0)
          });
          
          // ✅ Atualizar refs ANTES do refetch
          lastKnownTimestampRef.current = latestTimestamp;
          lastKnownCountRef.current = count;
          
          // ✅ Invalidar cache e refetch
          fetchPromiseRef.current = null;
          fetchTimestampRef.current = 0;
          
          await refetch();
          return true;
        }
        
        // ✅ Atualizar refs na primeira execução (silencioso)
        if (lastKnownTimestampRef.current === null) {
          lastKnownTimestampRef.current = latestTimestamp;
          lastKnownCountRef.current = count;
          console.log('📌 [POLLING v7] Valores iniciais registrados:', { 
            timestamp: latestTimestamp, 
            count: count 
          });
        } else if (lastKnownCountRef.current === null) {
          lastKnownCountRef.current = count;
        }
      }
      return false;
    } catch (err) {
      console.warn('⚠️ [POLLING v7] Erro ao verificar mudanças:', err);
      return false;
    }
  }, [refetch]);

  // Realtime updates com debounce e suporte a polling
  // ✅ CORRIGIDO: Removido update otimista que causava "paciente não encontrado"
  useRealtimeUpdates({
    table: 'agendamentos',
    onInsert: (payload) => {
      // ✅ Se é polling, verificar novos agendamentos por timestamp
      if (payload?._polling || payload?._forceRefresh) {
        console.log('🔄 [POLLING] Verificando novos agendamentos via timestamp...');
        checkForNewAppointments();
        return;
      }
      
      if (isOperatingRef.current || isPausedRef.current) {
        console.log('⏸️ [REALTIME] Insert ignorado - operação em andamento');
        return;
      }
      
      // ❌ REMOVIDO: Update otimista causava "Paciente não encontrado"
      // O payload do Realtime NÃO contém os JOINs (pacientes, medicos, atendimentos)
      // Isso causava exibição de dados incompletos seguido de "sumiço" após refetch
      
      // ✅ CORRIGIDO: Apenas invalidar cache e refetch imediato com dados COMPLETOS
      console.log('🆕 [REALTIME] Novo agendamento detectado, refetch imediato...');
      invalidateCache();
      
      // ⚡ Refetch em 500ms para garantir dados completos com relacionamentos
      setTimeout(() => {
        console.log('🔄 [REALTIME] Refetch completo com dados relacionados...');
        refetch();
      }, 500);
    },
    onUpdate: (payload) => {
      if (payload?._polling) return; // Polling trata apenas inserts
      
      if (isOperatingRef.current || isPausedRef.current) {
        console.log('⏸️ [REALTIME] Update ignorado - operação em andamento');
        return;
      }
      console.log('🔄 [REALTIME] Agendamento atualizado - refetch imediato');
      invalidateCache();
      debouncedRefetch();
    },
    onDelete: (payload) => {
      if (payload?._polling) return; // Polling trata apenas inserts
      
      if (isOperatingRef.current || isPausedRef.current) {
        console.log('⏸️ [REALTIME] Delete ignorado - operação em andamento');
        return;
      }
      console.log('🔄 [REALTIME] Agendamento deletado - refetch imediato');
      invalidateCache();
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
      
      // Refetch imediato após cancelar
      console.log('🔄 [CANCEL] Executando refetch imediato...');
      invalidateCache();
      await refetch();
      
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
      
      // Refetch imediato após confirmar
      console.log('🔄 [CONFIRM] Executando refetch imediato...');
      invalidateCache();
      await refetch();
      
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
    // ⚡ FASE 8: Funções para update otimista
    addAppointmentLocally,
    updateLocalAppointment,
  };
}
