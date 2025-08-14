import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppointmentWithRelations } from '@/types/scheduling';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedQuery } from '@/hooks/useOptimizedQuery';
import { usePagination } from '@/hooks/usePagination';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { useDataValidation } from '@/hooks/useDataValidation';
import { logger } from '@/utils/logger';

export function useAppointmentsList(itemsPerPage: number = 20) {
  const { toast } = useToast();
  const { measureApiCall } = usePerformanceMetrics();
  const { validateAppointmentsData, fetchCriticalData } = useDataValidation();
  const [lastValidationTime, setLastValidationTime] = useState<number>(0);

  // ✅ ESTABILIZAR: Função de query totalmente estável
  const fetchAppointments = useCallback(async () => {
    logger.info('Iniciando busca de agendamentos', {}, 'APPOINTMENTS');
    
    return measureApiCall(async () => {
        // 🔧 CORREÇÃO TEMPORÁRIA: Usar consulta direta enquanto corrigimos a RPC
        console.log('🔧 [CORREÇÃO] Usando consulta direta ao invés da RPC...');
        
        const { data: appointmentsWithRelations, error } = await supabase
          .from('agendamentos')
          .select(`
            *,
            pacientes!inner(
              id,
              nome_completo,
              data_nascimento,
              convenio,
              telefone,
              celular
            ),
            medicos!inner(
              id,
              nome,
              especialidade
            ),
            atendimentos!inner(
              id,
              nome,
              tipo
            )
          `)
          .order('data_agendamento', { ascending: false })
          .order('hora_agendamento', { ascending: false });

        if (error) {
          console.error('❌ [CORREÇÃO] Erro na consulta direta:', error);
          logger.error('Erro na consulta direta de agendamentos', error, 'APPOINTMENTS');
          throw error;
        }

        // 🔍 DIAGNÓSTICO: Contadores detalhados da consulta direta
        const rawTotal = appointmentsWithRelations?.length || 0;
        const rawAgendados = appointmentsWithRelations?.filter(apt => apt.status === 'agendado').length || 0;
        const rawConfirmados = appointmentsWithRelations?.filter(apt => apt.status === 'confirmado').length || 0;
        const rawCancelados = appointmentsWithRelations?.filter(apt => apt.status === 'cancelado').length || 0;
        
        console.log('🔍 [CORREÇÃO] Dados RAW da consulta DIRETA:', {
          totalRecords: rawTotal,
          agendados: rawAgendados,
          confirmados: rawConfirmados,
          cancelados: rawCancelados,
          statusBreakdown: appointmentsWithRelations?.reduce((acc, apt) => {
            acc[apt.status] = (acc[apt.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>) || {}
        });

        // ✅ Agora devemos ter TODOS os registros!
        if (rawAgendados >= 1200) {
          console.log('✅ [CORREÇÃO] SUCESSO: Consulta direta retornou todos os agendamentos!');
        } else {
          console.error('🚨 [CORREÇÃO] AINDA COM PROBLEMA: Consulta direta também tem poucos registros!');
        }

        // 🔧 Transformação simplificada para consulta direta
        const transformedAppointments = (appointmentsWithRelations || []).map((apt) => {
          return {
            id: apt.id,
            paciente_id: apt.paciente_id,
            medico_id: apt.medico_id,
            atendimento_id: apt.atendimento_id,
            data_agendamento: apt.data_agendamento,
            hora_agendamento: apt.hora_agendamento,
            status: apt.status,
            observacoes: apt.observacoes,
            created_at: apt.created_at,
            updated_at: apt.updated_at,
            criado_por: apt.criado_por,
            criado_por_user_id: apt.criado_por_user_id,
            // Campos adicionais para cancelamento e confirmação
            cancelado_em: apt.cancelado_em,
            cancelado_por: apt.cancelado_por,
            cancelado_por_user_id: apt.cancelado_por_user_id,
            confirmado_em: apt.confirmado_em,
            confirmado_por: apt.confirmado_por,
            confirmado_por_user_id: apt.confirmado_por_user_id,
            convenio: apt.convenio,
            pacientes: apt.pacientes ? {
              id: apt.pacientes.id,
              nome_completo: apt.pacientes.nome_completo,
              convenio: apt.pacientes.convenio,
              celular: apt.pacientes.celular,
              telefone: apt.pacientes.telefone || '',
              data_nascimento: apt.pacientes.data_nascimento || '',
              created_at: '',
              updated_at: ''
            } : null,
            medicos: apt.medicos ? {
              id: apt.medicos.id,
              nome: apt.medicos.nome,
              especialidade: apt.medicos.especialidade,
              ativo: true,
              crm: '',
              created_at: '',
              updated_at: '',
              convenios_aceitos: [],
              convenios_restricoes: null,
              horarios: null,
              idade_maxima: null,
              idade_minima: null,
              observacoes: ''
            } : null,
            atendimentos: apt.atendimentos ? {
              id: apt.atendimentos.id,
              nome: apt.atendimentos.nome,
              tipo: apt.atendimentos.tipo,
              ativo: true,
              medico_id: apt.medico_id,
              medico_nome: apt.medicos?.nome || '',
              created_at: '',
              updated_at: '',
              codigo: '',
              coparticipacao_unimed_20: 0,
              coparticipacao_unimed_40: 0,
              forma_pagamento: 'convenio',
              horarios: null,
              observacoes: '',
              valor_convenio: 0,
              valor_particular: 0,
              restricoes: null
            } : null
          };
        });

        // ✅ Verificação final dos dados transformados
        const finalTotal = transformedAppointments.length;
        const finalAgendados = transformedAppointments.filter(apt => apt.status === 'agendado').length;

        // ✅ SIMPLIFICADO: Log básico apenas
        logger.info(`Agendamentos carregados: ${finalTotal} registros`, {
          total: finalTotal,
          agendados: finalAgendados
        }, 'APPOINTMENTS');
        
        if (rawTotal !== finalTotal) {
          console.error('🚨 [DIAGNÓSTICO] PERDA DE DADOS NA TRANSFORMAÇÃO!', {
            dadosOriginais: rawTotal,
            dadosTransformados: finalTotal,
            dadosPerdidos: rawTotal - finalTotal
          });
        }

        if (rawAgendados !== finalAgendados) {
          console.error('🚨 [DIAGNÓSTICO] PERDA DE AGENDAMENTOS NA TRANSFORMAÇÃO!', {
            agendadosOriginais: rawAgendados,
            agendadosTransformados: finalAgendados,
            agendadosPerdidos: rawAgendados - finalAgendados
          });
        }

        // 🔍 DIAGNÓSTICO: Validar se algum registro foi corrompido ou filtrado
        const corruptedRecords = appointmentsWithRelations?.filter((original, index) => {
          const transformed = transformedAppointments[index];
          return !transformed || original.id !== transformed.id;
        }) || [];

        if (corruptedRecords.length > 0) {
          console.error('🚨 [DIAGNÓSTICO] REGISTROS CORROMPIDOS:', corruptedRecords.slice(0, 5));
        }

        logger.info('Agendamentos carregados com sucesso via RPC', { 
          count: transformedAppointments.length,
          originalCount: rawTotal,
          dataLoss: rawTotal - finalTotal
        }, 'APPOINTMENTS');
        
        return transformedAppointments;
      }, 'fetch_appointments', 'GET');
  }, [measureApiCall]);

  // 🔧 TEMPORÁRIO: Cache desabilitado para operações críticas
  const { data: appointments, loading, error, refetch, invalidateCache, forceRefetch } = useOptimizedQuery<AppointmentWithRelations[]>(
    fetchAppointments,
    [],
    { 
      cacheKey: 'appointments-list',
      cacheTime: 0, // 🚫 Cache desabilitado temporariamente
      staleTime: 0, // 🚫 Sempre buscar dados frescos
      disableCache: true // 🚫 Força dados frescos sempre
    }
  );

  // 🔍 VALIDAÇÃO AUTOMÁTICA: Verificar integridade dos dados
  useEffect(() => {
    const runValidation = async () => {
      if (!appointments || appointments.length === 0) return;
      
      const now = Date.now();
      // Executar validação a cada 30 segundos no máximo
      if (now - lastValidationTime < 30000) return;
      
      try {
        const validation = await validateAppointmentsData(appointments, (result) => {
          // Toast de inconsistência
          toast({
            title: '⚠️ Dados inconsistentes detectados',
            description: `Frontend: ${result.frontendCount} vs Banco: ${result.databaseCount} agendamentos`,
            variant: 'destructive',
          });
        });
        
        setLastValidationTime(now);
        
        // 🚨 Se dados estão inconsistentes, tentar recuperação automática
        if (validation.needsRefetch) {
          console.log('🔄 [AUTO-RECUPERAÇÃO] Tentando recuperar dados íntegros...');
          
          try {
            const criticalData = await fetchCriticalData();
            
            // Se dados críticos são diferentes dos atuais, forçar atualização
            if (criticalData.length !== appointments.length) {
              console.log('🔄 [AUTO-RECUPERAÇÃO] Forçando atualização com dados íntegros...');
              await forceRefetch();
            }
          } catch (error) {
            console.error('❌ [AUTO-RECUPERAÇÃO] Falha na recuperação automática:', error);
          }
        }
      } catch (error) {
        console.error('❌ [VALIDAÇÃO] Erro na validação automática:', error);
      }
    };

    runValidation();
  }, [appointments, validateAppointmentsData, fetchCriticalData, forceRefetch, lastValidationTime]);

  // Paginação
  const pagination = usePagination(appointments || [], { itemsPerPage });

  // ✅ ESTABILIZAR: Exibir erros sem colocar toast nas dependências  
  useEffect(() => {
    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os agendamentos',
        variant: 'destructive',
      });
    }
  }, [error]); // ✅ REMOVER toast das dependências

  // Buscar agendamentos por médico e data
  const getAppointmentsByDoctorAndDate = (doctorId: string, date: string) => {
    const filteredAppointments = (appointments || []).filter(
      appointment => 
        appointment.medico_id === doctorId && 
        appointment.data_agendamento === date
    );
    
    // 🔍 DEBUG: Log da filtragem por médico e data
    console.log('🔍 DEBUG - getAppointmentsByDoctorAndDate:', {
      doctorId,
      date,
      totalAppointments: appointments?.length || 0,
      filteredCount: filteredAppointments.length,
      filtered: filteredAppointments.map(apt => ({
        id: apt.id,
        medico_id: apt.medico_id,
        data_agendamento: apt.data_agendamento,
        hora_agendamento: apt.hora_agendamento,
        paciente: apt.pacientes?.nome_completo,
        status: apt.status
      }))
    });
    
    return filteredAppointments;
  };

  // Cancelar agendamento
  const cancelAppointment = async (appointmentId: string) => {
    try {
      logger.info('Cancelando agendamento', { appointmentId }, 'APPOINTMENTS');

      await measureApiCall(async () => {
        // Buscar perfil do usuário atual
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome, user_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();

        // Usar função de cancelamento com auditoria
        const { data, error } = await supabase.rpc('cancelar_agendamento_soft', {
          p_agendamento_id: appointmentId,
          p_cancelado_por: profile?.nome || 'Usuário',
          p_cancelado_por_user_id: profile?.user_id || null
        });

        if (error) {
          logger.error('Erro ao cancelar agendamento', error, 'APPOINTMENTS');
          throw error;
        }

        if (!(data as any)?.success) {
          const errorMessage = (data as any)?.error || 'Erro ao cancelar agendamento';
          logger.error('Erro no cancelamento', { error: errorMessage }, 'APPOINTMENTS');
          throw new Error(errorMessage);
        }

        return data;
      }, 'cancel_appointment', 'PUT');

      toast({
        title: 'Agendamento cancelado',
        description: 'O agendamento foi cancelado com sucesso',
      });

      // Invalidar cache e recarregar
      refetch();
      logger.info('Agendamento cancelado com sucesso', { appointmentId }, 'APPOINTMENTS');
    } catch (error) {
      logger.error('Erro ao cancelar agendamento', error, 'APPOINTMENTS');
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível cancelar o agendamento',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Confirmar agendamento
  const confirmAppointment = async (appointmentId: string) => {
    try {
      logger.info('Confirmando agendamento', { appointmentId }, 'APPOINTMENTS');

      await measureApiCall(async () => {
        // Buscar perfil do usuário atual
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome, user_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();

        // Usar função de confirmação com auditoria
        const { data, error } = await supabase.rpc('confirmar_agendamento', {
          p_agendamento_id: appointmentId,
          p_confirmado_por: profile?.nome || 'Usuário',
          p_confirmado_por_user_id: profile?.user_id || null
        });

        if (error) {
          logger.error('Erro ao confirmar agendamento', error, 'APPOINTMENTS');
          throw error;
        }

        if (!(data as any)?.success) {
          const errorMessage = (data as any)?.error || 'Erro ao confirmar agendamento';
          logger.error('Erro na confirmação', { error: errorMessage }, 'APPOINTMENTS');
          throw new Error(errorMessage);
        }

        return data;
      }, 'confirm_appointment', 'PUT');

      // ⚡ INVALIDAÇÃO AGRESSIVA DE CACHE APÓS CONFIRMAÇÃO
      console.log('🧹 Iniciando invalidação agressiva de cache após confirmação...');
      
      // 1. Invalidar cache imediatamente
      invalidateCache();
      
      // 2. Aguardar um pouco para garantir que mudança foi persistida no banco
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 3. Forçar refetch completo, ignorando qualquer cache
      await forceRefetch();
      
      console.log('✅ Cache invalidado e dados recarregados após confirmação');

      toast({
        title: 'Agendamento confirmado',
        description: 'O agendamento foi confirmado com sucesso',
      });

      logger.info('Agendamento confirmado com sucesso', { appointmentId }, 'APPOINTMENTS');
    } catch (error) {
      logger.error('Erro ao confirmar agendamento', error, 'APPOINTMENTS');
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível confirmar o agendamento',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Desconfirmar agendamento
  const unconfirmAppointment = async (appointmentId: string) => {
    try {
      logger.info('Desconfirmando agendamento', { appointmentId }, 'APPOINTMENTS');

      const result = await measureApiCall(async () => {
        // Buscar perfil do usuário atual
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome, user_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();

        // Usar função de desconfirmação com auditoria
        const { data, error } = await supabase.rpc('desconfirmar_agendamento', {
          p_agendamento_id: appointmentId,
          p_desconfirmado_por: profile?.nome || 'Usuário',
          p_desconfirmado_por_user_id: profile?.user_id || null
        });

        // 🐛 DEBUG: Log da resposta completa para debug
        console.log('🔍 Resposta completa da desconfirmação:', { data, error });

        if (error) {
          logger.error('Erro RPC ao desconfirmar agendamento', error, 'APPOINTMENTS');
          throw error;
        }

        // ✅ CORREÇÃO: Melhorar validação da resposta
        const response = data as { success?: boolean; error?: string; message?: string };
        
        if (!response || response.success === false) {
          const errorMessage = response?.error || response?.message || 'Erro ao desconfirmar agendamento';
          logger.error('Erro na validação da desconfirmação', { response, errorMessage }, 'APPOINTMENTS');
          throw new Error(errorMessage);
        }

        return data;
      }, 'unconfirm_appointment', 'PUT');

      // ⚡ INVALIDAÇÃO AGRESSIVA DE CACHE APÓS DESCONFIRMAÇÃO
      console.log('🧹 Iniciando invalidação agressiva de cache após desconfirmação...');
      
      // 1. Invalidar cache imediatamente
      invalidateCache();
      
      // 2. Aguardar um pouco para garantir que mudança foi persistida no banco
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 3. Forçar refetch completo, ignorando qualquer cache
      await forceRefetch();
      
      console.log('✅ Cache invalidado e dados recarregados após desconfirmação');

      toast({
        title: 'Agendamento desconfirmado',
        description: 'O agendamento foi desconfirmado com sucesso',
      });

      logger.info('Agendamento desconfirmado com sucesso', { appointmentId }, 'APPOINTMENTS');
    } catch (error) {
      logger.error('Erro ao desconfirmar agendamento', error, 'APPOINTMENTS');
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível desconfirmar o agendamento',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    appointments: appointments || [],
    loading,
    getAppointmentsByDoctorAndDate,
    cancelAppointment,
    confirmAppointment,
    unconfirmAppointment,
    refetch,
    invalidateCache,
    forceRefetch,
    pagination,
    error
  };
}