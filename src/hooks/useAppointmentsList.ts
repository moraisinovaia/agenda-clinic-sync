import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppointmentWithRelations } from '@/types/scheduling';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedQuery } from '@/hooks/useOptimizedQuery';
import { usePagination } from '@/hooks/usePagination';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { logger } from '@/utils/logger';

export function useAppointmentsList(itemsPerPage: number = 20) {
  const { toast } = useToast();
  const { measureApiCall } = usePerformanceMetrics();
  const [lastDataCount, setLastDataCount] = useState<number>(0);

  // 🚀 OTIMIZADO: Função para buscar todos os registros com paginação automática
  const fetchAllAppointmentsPaginated = useCallback(async (): Promise<AppointmentWithRelations[]> => {
    const pageSize = 500;
    let allAppointments: any[] = [];
    let page = 0;
    let hasMore = true;

    logger.info('Iniciando busca paginada de agendamentos', {}, 'APPOINTMENTS');

    while (hasMore) {
      const { data: pageData, error } = await supabase
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
        .order('hora_agendamento', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        logger.error('Erro na busca paginada', error, 'APPOINTMENTS');
        throw error;
      }

      if (!pageData || pageData.length === 0) {
        hasMore = false;
        break;
      }

      allAppointments = [...allAppointments, ...pageData];
      page++;

      // Prevenção contra loop infinito
      if (page > 10) {
        logger.warn('Limite de páginas atingido', { page, totalRecords: allAppointments.length }, 'APPOINTMENTS');
        break;
      }
    }

    return allAppointments;
  }, []);

  // 🔧 OTIMIZADO: Função principal com fallback
  const fetchAppointments = useCallback(async () => {
    return measureApiCall(async () => {
      let appointmentsData: any[] = [];

      try {
        // 🎯 Estratégia 1: Consulta direta com limite alto
        const { data: directData, error: directError } = await supabase
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
          .order('hora_agendamento', { ascending: false })
          .limit(5000); // Limite alto para garantir todos os registros

        if (directError) {
          throw directError;
        }

        appointmentsData = directData || [];

        // 🔍 Verificar se pode ter mais registros (próximo do limite)
        if (appointmentsData.length >= 4500) {
          logger.warn('Próximo do limite de 5000 registros, usando paginação', 
            { count: appointmentsData.length }, 'APPOINTMENTS');
          
          // Fallback para paginação automática
          appointmentsData = await fetchAllAppointmentsPaginated();
        }

      } catch (error) {
        logger.warn('Consulta direta falhou, tentando paginação', error, 'APPOINTMENTS');
        
        // 🎯 Estratégia 2: Paginação automática como fallback
        try {
          appointmentsData = await fetchAllAppointmentsPaginated();
        } catch (paginationError) {
          logger.error('Ambas as estratégias falharam', paginationError, 'APPOINTMENTS');
          throw paginationError;
        }
      }

      // ✅ Transformar dados para o formato esperado
      const transformedAppointments: AppointmentWithRelations[] = appointmentsData.map((apt) => ({
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
      }));

      // 📊 Validação silenciosa dos dados
      const totalCount = transformedAppointments.length;
      const agendadosCount = transformedAppointments.filter(apt => apt.status === 'agendado').length;
      
      // Alertar apenas se houver discrepância significativa
      if (lastDataCount > 0 && Math.abs(totalCount - lastDataCount) > 10) {
        logger.warn('Discrepância detectada nos dados', {
          anterior: lastDataCount,
          atual: totalCount,
          diferenca: totalCount - lastDataCount
        }, 'APPOINTMENTS');
      }

      setLastDataCount(totalCount);

      // ✅ Log otimizado apenas com informações essenciais
      logger.info('Agendamentos carregados', {
        total: totalCount,
        agendados: agendadosCount,
        strategy: appointmentsData.length >= 4500 ? 'pagination' : 'direct'
      }, 'APPOINTMENTS');

      return transformedAppointments;
    }, 'fetch_appointments', 'GET');
  }, [measureApiCall, fetchAllAppointmentsPaginated, lastDataCount]);

  // 🚀 OTIMIZADO: Cache inteligente reabilitado
  const { data: appointments, loading, error, refetch, invalidateCache, forceRefetch } = useOptimizedQuery<AppointmentWithRelations[]>(
    fetchAppointments,
    [],
    { 
      cacheKey: 'appointments-list-optimized',
      cacheTime: 5 * 60 * 1000, // 5 minutos de cache
      staleTime: 2 * 60 * 1000,  // 2 minutos para considerar stale
      refetchOnMount: true
    }
  );

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

      // ⚡ Atualização otimizada de cache
      invalidateCache();
      await forceRefetch();

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

      // ⚡ Atualização otimizada de cache
      invalidateCache();
      await forceRefetch();

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