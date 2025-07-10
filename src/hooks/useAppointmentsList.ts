import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppointmentWithRelations } from '@/types/scheduling';
import { useToast } from '@/hooks/use-toast';

export function useAppointmentsList() {
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Buscar agendamentos usando a função otimizada
  const fetchAppointments = async () => {
    try {
      console.log('🔍 Buscando agendamentos otimizados...');
      
      const { data, error } = await supabase.rpc('buscar_agendamentos_otimizado');

      if (error) {
        console.error('Erro na consulta de agendamentos:', error);
        throw error;
      }

      console.log('📋 Agendamentos encontrados:', data);

      // Transformar os dados para o formato esperado
      const appointmentsWithRelations = (data || []).map((row: any) => ({
        id: row.id,
        paciente_id: row.paciente_id,
        medico_id: row.medico_id,
        atendimento_id: row.atendimento_id,
        data_agendamento: row.data_agendamento,
        hora_agendamento: row.hora_agendamento,
        status: row.status,
        observacoes: row.observacoes,
        created_at: row.created_at,
        updated_at: row.updated_at,
        criado_por: row.criado_por,
        criado_por_user_id: row.criado_por_user_id,
        pacientes: {
          id: row.paciente_id,
          nome_completo: row.paciente_nome,
          convenio: row.paciente_convenio,
          celular: row.paciente_celular,
          data_nascimento: '', // Não incluído na função otimizada
          telefone: null,
          created_at: '',
          updated_at: '',
        },
        medicos: {
          id: row.medico_id,
          nome: row.medico_nome,
          especialidade: row.medico_especialidade,
          ativo: true,
          convenios_aceitos: null,
          convenios_restricoes: null,
          created_at: null,
          horarios: null,
          idade_maxima: null,
          idade_minima: null,
          observacoes: null,
        },
        atendimentos: {
          id: row.atendimento_id,
          nome: row.atendimento_nome,
          tipo: row.atendimento_tipo,
          ativo: true,
          codigo: null,
          coparticipacao_20: null,
          coparticipacao_40: null,
          created_at: null,
          forma_pagamento: null,
          horarios: null,
          medico_id: null,
          observacoes: null,
          restricoes: null,
          valor_particular: null,
        },
        criado_por_profile: null,
      }));

      setAppointments(appointmentsWithRelations);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      setAppointments([]);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os agendamentos',
        variant: 'destructive',
      });
    }
  };

  // Buscar agendamentos por médico e data
  const getAppointmentsByDoctorAndDate = (doctorId: string, date: string) => {
    return appointments.filter(
      appointment => 
        appointment.medico_id === doctorId && 
        appointment.data_agendamento === date
    );
  };

  // Cancelar agendamento
  const cancelAppointment = async (appointmentId: string) => {
    try {
      setLoading(true);
      console.log('🚫 Cancelando agendamento:', appointmentId);

      const { error } = await supabase
        .from('agendamentos')
        .update({ status: 'cancelado' })
        .eq('id', appointmentId);

      if (error) {
        console.error('❌ Erro ao cancelar agendamento:', error);
        throw error;
      }

      toast({
        title: 'Agendamento cancelado',
        description: 'O agendamento foi cancelado com sucesso',
      });

      // Recarregar agendamentos
      await fetchAppointments();
      console.log('✅ Agendamento cancelado e lista atualizada');
    } catch (error) {
      console.error('❌ Erro ao cancelar agendamento:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível cancelar o agendamento',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  return {
    appointments,
    loading,
    getAppointmentsByDoctorAndDate,
    cancelAppointment,
    refetch: fetchAppointments,
  };
}