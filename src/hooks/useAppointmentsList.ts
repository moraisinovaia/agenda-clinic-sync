import { useState, useEffect } from 'react';
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

  // Usar cache otimizado para buscar agendamentos
  const { data: appointments, loading, error, refetch } = useOptimizedQuery(
    async () => {
      logger.info('Iniciando busca de agendamentos', {}, 'APPOINTMENTS');
      
      return measureApiCall(async () => {
        // Primeiro buscar agendamentos simples
        const { data: agendamentosData, error: agendamentosError } = await supabase
          .from('agendamentos')
          .select('*')
          .order('data_agendamento', { ascending: true })
          .order('hora_agendamento', { ascending: true });

        if (agendamentosError) {
          logger.error('Erro na consulta de agendamentos', agendamentosError, 'APPOINTMENTS');
          throw agendamentosError;
        }

        // Se não há agendamentos, retornar array vazio
        if (!agendamentosData || agendamentosData.length === 0) {
          return [];
        }

        // Buscar dados relacionados separadamente
        const pacienteIds = [...new Set(agendamentosData.map(a => a.paciente_id))];
        const medicoIds = [...new Set(agendamentosData.map(a => a.medico_id))];
        const atendimentoIds = [...new Set(agendamentosData.map(a => a.atendimento_id))];
        const criadoPorUserIds = [...new Set(agendamentosData.map(a => a.criado_por_user_id).filter(Boolean))];

        const [pacientesResult, medicosResult, atendimentosResult, profilesResult] = await Promise.all([
          supabase.from('pacientes').select('*').in('id', pacienteIds),
          supabase.from('medicos').select('*').in('id', medicoIds),
          supabase.from('atendimentos').select('*').in('id', atendimentoIds),
          criadoPorUserIds.length > 0 
            ? supabase.from('profiles').select('*').in('user_id', criadoPorUserIds)
            : Promise.resolve({ data: [] })
        ]);

        const pacientesMap = new Map((pacientesResult.data || []).map(p => [p.id, p]));
        const medicosMap = new Map((medicosResult.data || []).map(m => [m.id, m]));
        const atendimentosMap = new Map((atendimentosResult.data || []).map(a => [a.id, a]));
        const profilesMap = new Map((profilesResult.data || []).map(p => [p.user_id, p]));

        // Combinar dados
        const appointmentsWithRelations = agendamentosData.map(agendamento => ({
          ...agendamento,
          pacientes: pacientesMap.get(agendamento.paciente_id) || null,
          medicos: medicosMap.get(agendamento.medico_id) || null,
          atendimentos: atendimentosMap.get(agendamento.atendimento_id) || null,
          criado_por_profile: agendamento.criado_por_user_id ? profilesMap.get(agendamento.criado_por_user_id) || null : null,
        }));

        logger.info('Agendamentos carregados com sucesso', { count: appointmentsWithRelations.length }, 'APPOINTMENTS');
        return appointmentsWithRelations;
      }, 'fetch_appointments', 'GET');
    },
    [],
    { 
      cacheKey: 'appointments-list',
      cacheTime: 5 * 60 * 1000, // 5 minutos
      staleTime: 30 * 1000 // 30 segundos
    }
  );

  // Paginação
  const pagination = usePagination(appointments || [], { itemsPerPage });

  // Exibir erros
  useEffect(() => {
    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os agendamentos',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

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
        const { error } = await supabase
          .from('agendamentos')
          .update({ status: 'cancelado' })
          .eq('id', appointmentId);

        if (error) {
          logger.error('Erro ao cancelar agendamento', error, 'APPOINTMENTS');
          throw error;
        }

        return null;
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
        description: 'Não foi possível cancelar o agendamento',
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
    refetch,
    pagination,
    error
  };
}