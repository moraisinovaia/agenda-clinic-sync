import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppointmentWithRelations } from '@/types/scheduling';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedQuery } from '@/hooks/useOptimizedQuery';
import { usePagination } from '@/hooks/usePagination';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { logger } from '@/utils/logger';

export function useAppointmentsList(itemsPerPage: number = 20) {
  const { toast } = useToast();
  const { measureApiCall } = usePerformanceMetrics();

  // ✅ ESTABILIZAR: Função de query totalmente estável
  const fetchAppointments = useCallback(async () => {
    logger.info('Iniciando busca de agendamentos', {}, 'APPOINTMENTS');
    
    return measureApiCall(async () => {
        // Usar função RPC otimizada que já filtra cancelados e inclui relacionamentos
        const { data: appointmentsWithRelations, error } = await supabase
          .rpc('buscar_agendamentos_otimizado');

        if (error) {
          logger.error('Erro na consulta de agendamentos otimizada', error, 'APPOINTMENTS');
          throw error;
        }

        // Transformar para o formato esperado
        const transformedAppointments = (appointmentsWithRelations || []).map(apt => ({
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
          alterado_por_user_id: apt.alterado_por_user_id,
          cliente_id: '00000000-0000-0000-0000-000000000000', // Usar ID padrão temporário
          // Campos adicionais para cancelamento e confirmação
          cancelado_em: apt.cancelado_em,
          cancelado_por: apt.cancelado_por,
          cancelado_por_user_id: apt.cancelado_por_user_id,
          confirmado_em: apt.confirmado_em,
          confirmado_por: apt.confirmado_por,
          confirmado_por_user_id: apt.confirmado_por_user_id,
          convenio: apt.paciente_convenio,
          // Informações do perfil de quem criou o agendamento
          criado_por_profile: apt.profile_nome ? {
            id: apt.criado_por_user_id || '',
            user_id: apt.criado_por_user_id || '',
            nome: apt.profile_nome,
            email: apt.profile_email || '',
            role: apt.profile_role || 'recepcionista',
            ativo: true,
            created_at: apt.created_at || '',
            updated_at: apt.updated_at || ''
          } : null,
          // Informações do perfil de quem alterou o agendamento - só se realmente foi alterado
          alterado_por_profile: (apt.alterado_por_user_id && apt.alterado_por_profile_nome) ? {
            id: apt.alterado_por_user_id,
            user_id: apt.alterado_por_user_id,
            nome: apt.alterado_por_profile_nome,
            email: apt.alterado_por_profile_email || '',
            role: apt.alterado_por_profile_role || 'recepcionista',
            ativo: true,
            created_at: apt.created_at || '',
            updated_at: apt.updated_at || ''
          } : null,
          pacientes: {
            id: apt.paciente_id,
            nome_completo: apt.paciente_nome,
            convenio: apt.paciente_convenio,
            celular: apt.paciente_celular,
            telefone: apt.paciente_telefone || '',
            data_nascimento: apt.paciente_data_nascimento || '',
            created_at: '',
            updated_at: '',
            cliente_id: '00000000-0000-0000-0000-000000000000' // Usar ID padrão temporário
          },
          medicos: {
            id: apt.medico_id,
            nome: apt.medico_nome,
            especialidade: apt.medico_especialidade,
            ativo: true,
            crm: '',
            created_at: '',
            updated_at: '',
            convenios_aceitos: [],
            convenios_restricoes: null,
            horarios: null,
            idade_maxima: null,
            idade_minima: null,
            observacoes: '',
            cliente_id: '00000000-0000-0000-0000-000000000000' // Usar ID padrão temporário
          },
          atendimentos: {
            id: apt.atendimento_id,
            nome: apt.atendimento_nome,
            tipo: apt.atendimento_tipo,
            ativo: true,
            medico_id: apt.medico_id,
            medico_nome: apt.medico_nome,
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
            restricoes: null,
            cliente_id: '00000000-0000-0000-0000-000000000000' // Usar ID padrão temporário
          }
        }));

        logger.info('Agendamentos carregados com sucesso via RPC', { count: transformedAppointments.length }, 'APPOINTMENTS');
        return transformedAppointments;
      }, 'fetch_appointments', 'GET');
  }, [measureApiCall]);

  // Usar cache otimizado para buscar agendamentos
  const { data: appointments, loading, error, refetch, invalidateCache, forceRefetch } = useOptimizedQuery<AppointmentWithRelations[]>(
    fetchAppointments,
    [],
    { 
      cacheKey: 'appointments-list',
      cacheTime: 5 * 60 * 1000, // 5 minutos
      staleTime: 30 * 1000 // 30 segundos
    }
  );

  // ✅ REALTIME: Configurar atualizações em tempo real para agendamentos
  useRealtimeUpdates({
    table: 'agendamentos',
    onInsert: (payload) => {
      console.log('🔄 useAppointmentsList: New appointment inserted', payload);
      refetch(); // Refetch automatico quando novo agendamento é criado
      toast({
        title: "Novo agendamento",
        description: "Um novo agendamento foi criado e o calendário foi atualizado!",
      });
    },
    onUpdate: (payload) => {
      console.log('🔄 useAppointmentsList: Appointment updated', payload);
      refetch(); // Refetch automatico quando agendamento é atualizado
    },
    onDelete: (payload) => {
      console.log('🔄 useAppointmentsList: Appointment deleted', payload);
      refetch(); // Refetch automatico quando agendamento é deletado
    }
  });

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
    return (appointments || []).filter(
      appointment => 
        appointment.medico_id === doctorId && 
        appointment.data_agendamento === date
    );
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