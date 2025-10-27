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
  console.log('🏁 useAppointmentsList: Hook inicializado (Paginação Manual)');
  
  const { toast } = useToast();
  const { measureApiCall } = usePerformanceMetrics();
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastErrorRef = useRef<string | null>(null);
  const isOperatingRef = useRef(false);
  const isFetchingRef = useRef(false); // 🔒 Lock para prevenir múltiplas execuções simultâneas

  // ✅ FUNÇÃO DE QUERY DIRETA COM JOINS OTIMIZADOS
  const fetchAppointments = useCallback(async () => {
    const executionId = Math.random().toString(36).substring(7);
    console.log(`🚀 [FETCH-${executionId}] ========== INÍCIO DA BUSCA DE AGENDAMENTOS ==========`);
    
    // 🔒 Aguardar se já houver busca em andamento
    while (isFetchingRef.current) {
      console.log(`⏸️ [FETCH-${executionId}] Aguardando busca em andamento...`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    isFetchingRef.current = true;
    console.log(`🔍 [FETCH-${executionId}] Iniciando busca paginada manual...`);
    
    return measureApiCall(async () => {
      try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const dateFilter = sixMonthsAgo.toISOString().split('T')[0];
        
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
          
          // Segurança: limite de 20 páginas (20k registros)
          if (currentPage >= 20) {
            console.warn('⚠️ Limite de segurança: 20 páginas atingido');
            hasMore = false;
          }
        }
        
        console.log(`✅ [FINAL] Total carregado: ${allAppointments.length} agendamentos`);
        
        // Buscar profiles dos usuários que criaram/alteraram
        const userIds = new Set<string>();
        allAppointments.forEach((apt: any) => {
          if (apt.criado_por_user_id) userIds.add(apt.criado_por_user_id);
          if (apt.alterado_por_user_id) userIds.add(apt.alterado_por_user_id);
        });

        let profilesMap: Record<string, any> = {};
        
        if (userIds.size > 0) {
          console.log(`🔍 [PROFILES] Buscando ${userIds.size} perfis de usuários...`);
          console.log(`🔍 [PROFILES] User IDs:`, Array.from(userIds));
          
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, nome, email, ativo, created_at, updated_at')
            .in('user_id', Array.from(userIds));
          
          if (profilesError) {
            console.error('❌ [PROFILES] Erro ao buscar perfis:', profilesError);
          } else if (profiles) {
            console.log(`✅ [PROFILES] ${profiles.length} perfis encontrados:`, profiles);
            profilesMap = profiles.reduce((acc, profile) => {
              acc[profile.user_id] = profile;
              return acc;
            }, {} as Record<string, any>);
            console.log(`✅ [PROFILES] Mapa de perfis criado:`, profilesMap);
          }
        }
        
        // Transformar dados
        console.log(`🔄 [TRANSFORM] Transformando ${allAppointments.length} agendamentos...`);
        console.log(`📋 [TRANSFORM] ProfilesMap disponível:`, {
          totalProfiles: Object.keys(profilesMap).length,
          profileIds: Object.keys(profilesMap)
        });
        
        const transformedAppointments: AppointmentWithRelations[] = allAppointments.map((apt: any, index: number) => {
          const criadoPorProfile = apt.criado_por_user_id ? profilesMap[apt.criado_por_user_id] || null : null;
          const alteradoPorProfile = apt.alterado_por_user_id ? profilesMap[apt.alterado_por_user_id] || null : null;
          
          // Debug: Log dos primeiros 5 agendamentos
          if (index < 5) {
            console.log(`🔍 [TRANSFORM-${index}] Agendamento ${apt.id.substring(0, 8)}:`, {
              criado_por: apt.criado_por,
              criado_por_user_id: apt.criado_por_user_id,
              criado_por_profile: criadoPorProfile,
              profile_nome: criadoPorProfile?.nome,
              alterado_por_user_id: apt.alterado_por_user_id,
              alterado_por_profile: alteradoPorProfile
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
        console.log(`👥 [FETCH-${executionId}] Profiles carregados: ${Object.keys(profilesMap).length}`);
        
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
      } finally {
        // 🔓 Liberar o lock
        isFetchingRef.current = false;
        console.log('🔓 [FETCH] Lock liberado');
      }
    }, 'fetch_appointments', 'GET');
  }, [measureApiCall]);

  // 🔥 Limpar TODO o cache ao montar o componente
  useEffect(() => {
    console.log('🧹 [CACHE] Limpando TODO o cache ao montar componente');
    clearAllCache();
  }, []);

  // ✅ CACHE DESABILITADO TEMPORARIAMENTE PARA DEBUG
  const { data: appointments, loading, error, refetch, invalidateCache, forceRefetch } = useOptimizedQuery<AppointmentWithRelations[]>(
    fetchAppointments,
    [],
    { 
      cacheKey: 'appointments-list-DEBUG-PROFILES-' + Date.now(), // 🔑 Cache key com timestamp para forçar reload
      cacheTime: 0, // 🔥 CACHE DESABILITADO para debug
      staleTime: 0 // 🔥 STALE DESABILITADO para debug
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
