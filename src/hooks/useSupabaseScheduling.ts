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

  // Buscar agendamentos - versão simplificada para debugging
  const fetchAppointments = async () => {
    try {
      console.log('🔍 Buscando agendamentos...');
      
      // Primeiro buscar agendamentos simples
      const { data: agendamentosData, error: agendamentosError } = await supabase
        .from('agendamentos')
        .select('*')
        .order('data_agendamento', { ascending: true })
        .order('hora_agendamento', { ascending: true });

      console.log('📋 Agendamentos encontrados:', agendamentosData);

      if (agendamentosError) {
        console.error('Erro na consulta de agendamentos:', agendamentosError);
        throw agendamentosError;
      }

      // Se não há agendamentos, definir array vazio
      if (!agendamentosData || agendamentosData.length === 0) {
        setAppointments([]);
        return;
      }

      // Buscar dados relacionados separadamente
      const pacienteIds = [...new Set(agendamentosData.map(a => a.paciente_id))];
      const medicoIds = [...new Set(agendamentosData.map(a => a.medico_id))];
      const atendimentoIds = [...new Set(agendamentosData.map(a => a.atendimento_id))];

      const [pacientesResult, medicosResult, atendimentosResult] = await Promise.all([
        supabase.from('pacientes').select('*').in('id', pacienteIds),
        supabase.from('medicos').select('*').in('id', medicoIds),
        supabase.from('atendimentos').select('*').in('id', atendimentoIds)
      ]);

      const pacientesMap = new Map((pacientesResult.data || []).map(p => [p.id, p]));
      const medicosMap = new Map((medicosResult.data || []).map(m => [m.id, m]));
      const atendimentosMap = new Map((atendimentosResult.data || []).map(a => [a.id, a]));

      // Combinar dados
      const appointmentsWithRelations = agendamentosData.map(agendamento => ({
        ...agendamento,
        pacientes: pacientesMap.get(agendamento.paciente_id) || null,
        medicos: medicosMap.get(agendamento.medico_id) || null,
        atendimentos: atendimentosMap.get(agendamento.atendimento_id) || null,
      }));

      setAppointments(appointmentsWithRelations);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      setAppointments([]); // Definir array vazio em caso de erro
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os agendamentos',
        variant: 'destructive',
      });
    }
  };

  // Buscar pacientes por data de nascimento
  const searchPatientsByBirthDate = async (birthDate: string) => {
    try {
      console.log('🔍 Buscando pacientes por data de nascimento:', birthDate);
      
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .eq('data_nascimento', birthDate)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar pacientes:', error);
        throw error;
      }

      // Remover duplicatas baseado no nome completo e convênio para evitar pacientes repetidos
      const uniquePatients = data ? data.reduce((acc, current) => {
        const existing = acc.find(patient => 
          patient.nome_completo.toLowerCase() === current.nome_completo.toLowerCase() &&
          patient.convenio === current.convenio
        );
        if (!existing) {
          acc.push(current);
        }
        return acc;
      }, [] as typeof data) : [];

      console.log('📋 Pacientes únicos encontrados:', uniquePatients);
      return uniquePatients;
    } catch (error) {
      console.error('❌ Erro ao buscar pacientes:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível buscar os pacientes',
        variant: 'destructive',
      });
      return [];
    }
  };
  const createAppointment = async (formData: SchedulingFormData) => {
    try {
      setLoading(true);
      console.log('🚀 Criando agendamento:', formData);

      // Validar dados obrigatórios
      if (!formData.medicoId || formData.medicoId.trim() === '') {
        throw new Error('Médico é obrigatório');
      }
      if (!formData.atendimentoId || formData.atendimentoId.trim() === '') {
        throw new Error('Tipo de atendimento é obrigatório');
      }
      if (!formData.nomeCompleto || formData.nomeCompleto.trim() === '') {
        throw new Error('Nome completo é obrigatório');
      }
      if (!formData.dataNascimento) {
        throw new Error('Data de nascimento é obrigatória');
      }
      if (!formData.convenio || formData.convenio.trim() === '') {
        throw new Error('Convênio é obrigatório');
      }
      if (!formData.celular || formData.celular.trim() === '') {
        throw new Error('Celular é obrigatório');
      }
      if (!formData.dataAgendamento) {
        throw new Error('Data do agendamento é obrigatória');
      }
      if (!formData.horaAgendamento) {
        throw new Error('Hora do agendamento é obrigatória');
      }

      // Validar se a data/hora não é no passado
      const appointmentDateTime = new Date(`${formData.dataAgendamento}T${formData.horaAgendamento}`);
      const now = new Date();
      
      if (appointmentDateTime <= now) {
        throw new Error('Não é possível agendar para uma data/hora que já passou');
      }

      // Verificar se já existe um agendamento no mesmo horário para o mesmo médico
      const { data: existingAppointment, error: conflictError } = await supabase
        .from('agendamentos')
        .select('id')
        .eq('medico_id', formData.medicoId)
        .eq('data_agendamento', formData.dataAgendamento)
        .eq('hora_agendamento', formData.horaAgendamento)
        .eq('status', 'agendado')
        .maybeSingle();

      if (conflictError) {
        console.error('❌ Erro ao verificar conflitos de horário:', conflictError);
        throw new Error('Erro ao verificar disponibilidade do horário');
      }

      if (existingAppointment) {
        throw new Error('Este horário já está ocupado para o médico selecionado. Por favor, escolha outro horário.');
      }

      // Primeiro, criar o paciente
      const { data: patientData, error: patientError } = await supabase
        .from('pacientes')
        .insert({
          nome_completo: formData.nomeCompleto,
          data_nascimento: formData.dataNascimento,
          convenio: formData.convenio,
          telefone: formData.telefone || null, // Telefone opcional
          celular: formData.celular,
        })
        .select()
        .single();

      if (patientError) {
        console.error('❌ Erro ao criar paciente:', patientError);
        throw patientError;
      }
      console.log('✅ Paciente criado:', patientData);

      // Depois, criar o agendamento
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

      if (appointmentError) {
        console.error('❌ Erro ao criar agendamento:', appointmentError);
        throw appointmentError;
      }
      console.log('✅ Agendamento criado:', appointmentData);

      toast({
        title: 'Sucesso!',
        description: `Agendamento criado para ${formData.dataAgendamento} às ${formData.horaAgendamento}`,
      });

      // Recarregar todos os dados para garantir consistência
      console.log('🔄 Recarregando todos os dados...');
      await Promise.all([fetchDoctors(), fetchAtendimentos(), fetchAppointments()]);
      console.log('✅ Todos os dados recarregados');
      
      return appointmentData;
    } catch (error) {
      console.error('❌ Erro ao criar agendamento:', error);
      
      // Se é um erro de validação (Error específico), mostrar a mensagem específica
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível criar o agendamento';
      
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoading(false);
    }
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
    cancelAppointment,
    searchPatientsByBirthDate,
    getAtendimentosByDoctor,
    getAppointmentsByDoctorAndDate,
    refetch: () => Promise.all([fetchDoctors(), fetchAtendimentos(), fetchAppointments()]),
  };
}