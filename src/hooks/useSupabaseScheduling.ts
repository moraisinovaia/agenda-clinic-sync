import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Doctor, Atendimento, Patient, Appointment, SchedulingFormData, AppointmentWithRelations } from '@/types/scheduling';
import { useToast } from '@/hooks/use-toast';

export function useSupabaseScheduling() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Buscar médicos ativos
  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('medicos')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setDoctors(data || []);
    } catch (error) {
      console.error('Erro ao buscar médicos:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os médicos',
        variant: 'destructive',
      });
    }
  };

  // Buscar atendimentos ativos
  const fetchAtendimentos = async () => {
    try {
      const { data, error } = await supabase
        .from('atendimentos')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setAtendimentos(data || []);
    } catch (error) {
      console.error('Erro ao buscar atendimentos:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os tipos de atendimento',
        variant: 'destructive',
      });
    }
  };

  // Buscar agendamentos
  const fetchAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('agendamentos')
        .select(`
          *,
          pacientes (*),
          medicos (*),
          atendimentos (*)
        `)
        .order('data_agendamento', { ascending: true })
        .order('hora_agendamento', { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os agendamentos',
        variant: 'destructive',
      });
    }
  };

  // Criar novo agendamento
  const createAppointment = async (formData: SchedulingFormData) => {
    try {
      console.log('=== DEBUG CREATE APPOINTMENT ===');
      console.log('FormData received:', formData);
      setLoading(true);

      // Primeiro, criar o paciente
      console.log('Creating patient...');
      const { data: patientData, error: patientError } = await supabase
        .from('pacientes')
        .insert({
          nome_completo: formData.nomeCompleto,
          data_nascimento: formData.dataNascimento,
          convenio: formData.convenio,
          telefone: formData.telefone,
        })
        .select()
        .single();

      console.log('Patient creation result:', { patientData, patientError });

      if (patientError) {
        console.error('Patient creation error:', patientError);
        throw patientError;
      }

      // Depois, criar o agendamento
      console.log('Creating appointment...');
      const { data: appointmentData, error: appointmentError } = await supabase
        .from('agendamentos')
        .insert({
          paciente_id: patientData.id,
          medico_id: formData.medicoId,
          atendimento_id: formData.atendimentoId,
          data_agendamento: formData.dataAgendamento,
          hora_agendamento: formData.horaAgendamento,
          observacoes: formData.observacoes,
          criado_por: 'recepcionista',
        })
        .select()
        .single();

      console.log('Appointment creation result:', { appointmentData, appointmentError });

      if (appointmentError) {
        console.error('Appointment creation error:', appointmentError);
        throw appointmentError;
      }

      toast({
        title: 'Sucesso!',
        description: 'Agendamento criado com sucesso',
      });

      // Recarregar agendamentos
      await fetchAppointments();
      
      return appointmentData;
    } catch (error) {
      console.error('=== FULL ERROR DETAILS ===');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      console.error('Error hint:', error.hint);
      console.error('Error code:', error.code);
      
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o agendamento',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Buscar atendimentos por médico
  const getAtendimentosByDoctor = (doctorId: string) => {
    return atendimentos.filter(atendimento => atendimento.medico_id === doctorId);
  };

  // Buscar agendamentos por médico e data
  const getAppointmentsByDoctorAndDate = (doctorId: string, date: string) => {
    return appointments.filter(
      appointment => 
        appointment.medico_id === doctorId && 
        appointment.data_agendamento === date
    );
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchDoctors(),
        fetchAtendimentos(),
        fetchAppointments(),
      ]);
      setLoading(false);
    };

    loadData();
  }, []);

  return {
    doctors,
    atendimentos,
    appointments,
    loading,
    createAppointment,
    getAtendimentosByDoctor,
    getAppointmentsByDoctorAndDate,
    refetch: () => Promise.all([fetchDoctors(), fetchAtendimentos(), fetchAppointments()]),
  };
}