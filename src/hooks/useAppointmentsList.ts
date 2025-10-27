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

// 🔄 CACHE BUSTER: Versão FINAL 2025-10-27-16:00 - Solução definitiva de cache
export function useAppointmentsList(itemsPerPage: number = 20) {
  console.log('🏁 useAppointmentsList: Hook inicializado');
  
  // ✅ LIMPAR TODO O CACHE antes de buscar dados
  useEffect(() => {
    console.log('🧹 Limpando TODOS os caches antes de buscar agendamentos');
    clearAllCache();
  }, []);
  
  const { toast } = useToast();
  const { measureApiCall } = usePerformanceMetrics();
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastErrorRef = useRef<string | null>(null);
  const isOperatingRef = useRef(false);

  // ✅ FUNÇÃO DE QUERY COM LOGS DETALHADOS
  const fetchAppointments = useCallback(async () => {
    console.log('🔍 [FETCH] Iniciando busca de agendamentos...');
    
    return measureApiCall(async () => {
      try {
        // 1️⃣ BUSCAR DADOS DA RPC (SETOF json - sem limite PostgREST)
        const { data: rawData, error } = await supabase
          .rpc('buscar_agendamentos_otimizado', {
            p_data_inicio: null,
            p_data_fim: null,
            p_medico_id: null,
            p_status: null
          });

        console.log('📊 [RPC] Resposta recebida:', {
          registros_retornados: rawData?.length || 0,
          esperado: 1184,
          faltam: 1184 - (rawData?.length || 0),
          tem_erro: !!error,
          percentual: `${((rawData?.length || 0) / 1184 * 100).toFixed(1)}%`,
          timestamp: new Date().toISOString()
        });
        
        // ✅ Log crítico: mostrar que recebemos dados FRESCOS
        console.log(`✅ DADOS FRESCOS CARREGADOS: ${rawData?.length || 0} registros recebidos AGORA`);

        if (error) {
          console.error('❌ [RPC] Erro na consulta:', error);
          logger.error('Erro na consulta de agendamentos otimizada', error, 'APPOINTMENTS');
          throw error;
        }

        if (!rawData || rawData.length === 0) {
          console.warn('⚠️ [RPC] Nenhum dado retornado!');
          return [];
        }

        // 2️⃣ VALIDAÇÃO MÍNIMA: Apenas ID obrigatório (outros campos podem ser NULL)
        console.log('🔍 [VALIDAÇÃO] Verificando integridade dos dados...');
        const invalidRecords: any[] = [];
        const validRecords: any[] = [];

        rawData.forEach((record: any, index) => {
          // ✅ CORREÇÃO: Validar APENAS id (campos relacionados podem ser NULL por LEFT JOIN)
          if (!record.id) {
            invalidRecords.push({ index, record, motivo: 'ID ausente' });
            console.warn(`⚠️ [VALIDAÇÃO] Registro ${index} SEM ID`);
          } else {
            validRecords.push(record);
          }
        });

        console.log('📊 [VALIDAÇÃO] Resultado:', {
          total_recebido: rawData.length,
          validos: validRecords.length,
          invalidos: invalidRecords.length,
          percentual_valido: ((validRecords.length / rawData.length) * 100).toFixed(2) + '%'
        });

        if (invalidRecords.length > 0) {
          console.warn('⚠️ [VALIDAÇÃO] Registros inválidos encontrados:', invalidRecords.slice(0, 5));
        }

        // 3️⃣ TRANSFORMAR DADOS
        console.log('🔄 [TRANSFORM] Iniciando transformação de', validRecords.length, 'registros...');
        const transformedAppointments: AppointmentWithRelations[] = [];
        const transformErrors: any[] = [];

        validRecords.forEach((apt, index) => {
          try {
            const transformed: AppointmentWithRelations = {
              id: apt.id,
              paciente_id: apt.paciente_id,
              medico_id: apt.medico_id,
              atendimento_id: apt.atendimento_id,
              data_agendamento: apt.data_agendamento,
              hora_agendamento: apt.hora_agendamento || '00:00:00', // ✅ Fallback
              status: apt.status || 'agendado', // ✅ Fallback
              observacoes: apt.observacoes,
              created_at: apt.created_at,
              updated_at: apt.updated_at,
              criado_por: apt.criado_por,
              criado_por_user_id: apt.criado_por_user_id,
              alterado_por_user_id: apt.alterado_por_user_id,
              cliente_id: '00000000-0000-0000-0000-000000000000',
              cancelado_em: apt.cancelado_em,
              cancelado_por: apt.cancelado_por,
              cancelado_por_user_id: apt.cancelado_por_user_id,
              confirmado_em: apt.confirmado_em,
              confirmado_por: apt.confirmado_por,
              confirmado_por_user_id: apt.confirmado_por_user_id,
              excluido_em: apt.excluido_em,
              excluido_por: apt.excluido_por,
              excluido_por_user_id: apt.excluido_por_user_id,
              convenio: apt.paciente_convenio || apt.convenio,
              criado_por_profile: apt.profile_nome ? {
                id: apt.criado_por_user_id || '',
                user_id: apt.criado_por_user_id || '',
                nome: apt.profile_nome,
                email: apt.profile_email || '',
                ativo: true,
                created_at: apt.created_at,
                updated_at: apt.updated_at,
              } : null,
              alterado_por_profile: apt.alterado_por_profile_nome ? {
                id: apt.alterado_por_user_id || '',
                user_id: apt.alterado_por_user_id || '',
                nome: apt.alterado_por_profile_nome,
                email: apt.alterado_por_profile_email || '',
                ativo: true,
                created_at: apt.created_at,
                updated_at: apt.updated_at,
              } : null,
              pacientes: {
                id: apt.paciente_id,
                nome_completo: apt.paciente_nome || 'Nome não disponível',
                convenio: apt.paciente_convenio,
                celular: apt.paciente_celular || '',
                telefone: apt.paciente_telefone || '',
                data_nascimento: apt.paciente_data_nascimento || '',
                created_at: '',
                updated_at: '',
                cliente_id: '00000000-0000-0000-0000-000000000000'
              },
              medicos: {
                id: apt.medico_id,
                nome: apt.medico_nome || 'Médico não disponível',
                especialidade: apt.medico_especialidade || '',
                ativo: true,
                created_at: '',
                convenios_aceitos: [],
                convenios_restricoes: null,
                horarios: null,
                idade_maxima: null,
                idade_minima: null,
                observacoes: '',
                cliente_id: '00000000-0000-0000-0000-000000000000'
              },
              atendimentos: {
                id: apt.atendimento_id,
                nome: apt.atendimento_nome || 'Atendimento não disponível',
                tipo: apt.atendimento_tipo || 'consulta',
                ativo: true,
                medico_id: apt.medico_id,
                medico_nome: apt.medico_nome,
                created_at: '',
                codigo: '',
                coparticipacao_unimed_20: 0,
                coparticipacao_unimed_40: 0,
                forma_pagamento: 'convenio',
                horarios: null,
                observacoes: '',
                valor_particular: 0,
                restricoes: null,
                cliente_id: '00000000-0000-0000-0000-000000000000'
              }
            };

            transformedAppointments.push(transformed);
          } catch (err) {
            transformErrors.push({ index, apt, error: err });
            console.error(`❌ [TRANSFORM] Erro ao transformar registro ${index}:`, err, apt);
          }
        });

        console.log('📊 [TRANSFORM] Resultado:', {
          registros_transformados: transformedAppointments.length,
          erros_transformacao: transformErrors.length,
          registros_perdidos: validRecords.length - transformedAppointments.length
        });

        if (transformErrors.length > 0) {
          console.error('❌ [TRANSFORM] Erros encontrados:', transformErrors.slice(0, 5));
        }

        // 4️⃣ ESTATÍSTICAS FINAIS
        console.log('✅ [FINAL] Resumo completo:', {
          esperado_total: 1184,
          recebido_rpc: rawData.length,
          validos_validacao: validRecords.length,
          transformados_sucesso: transformedAppointments.length,
          perdidos_validacao: rawData.length - validRecords.length,
          perdidos_transformacao: validRecords.length - transformedAppointments.length,
          perdidos_total: 1184 - transformedAppointments.length,
          percentual_sucesso: ((transformedAppointments.length / 1184) * 100).toFixed(2) + '%'
        });

        // 5️⃣ ANÁLISE POR STATUS
        const statusCount = transformedAppointments.reduce((acc, apt) => {
          acc[apt.status] = (acc[apt.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        console.log('📊 [STATUS] Distribuição:', statusCount);

        logger.info('Agendamentos carregados com sucesso', { 
          count: transformedAppointments.length,
          esperado: 1184,
          perdidos: 1184 - transformedAppointments.length
        }, 'APPOINTMENTS');

        return transformedAppointments;
      } catch (err) {
        console.error('❌ [FETCH] Erro fatal:', err);
        logger.error('Erro ao buscar agendamentos', err, 'APPOINTMENTS');
        throw err;
      }
    }, 'fetch_appointments', 'GET');
  }, [measureApiCall]);

  // ✅ DESABILITAR CACHE COMPLETAMENTE
  const { data: appointments, loading, error, refetch, invalidateCache, forceRefetch } = useOptimizedQuery<AppointmentWithRelations[]>(
    fetchAppointments,
    [],
    { 
      cacheKey: 'appointments-list-FINAL-v2025-10-27-16:00', // ✅ Cache NUNCA será usado (cacheTime=0)
      cacheTime: 0, // ✅ Cache desabilitado
      staleTime: 0, // ✅ Sempre considerar stale
      refetchOnMount: true // ✅ Sempre refetch ao montar
    }
  );

  // Log imediato após useOptimizedQuery
  console.log('🔍 useAppointmentsList: Estado do useOptimizedQuery', {
    appointmentsCount: appointments?.length || 0,
    loading,
    hasError: !!error,
    errorMessage: error?.message
  });

  // Log quando appointments mudar
  useEffect(() => {
    if (appointments) {
      console.log('📊 [STATE] Appointments atualizados:', {
        total: appointments.length,
        esperado: 1184,
        diferenca: 1184 - appointments.length
      });
    }
  }, [appointments]);

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
