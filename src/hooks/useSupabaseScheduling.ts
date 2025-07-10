import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Doctor, Atendimento, Patient, Appointment, SchedulingFormData, AppointmentWithRelations } from '@/types/scheduling';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export function useSupabaseScheduling() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, profile } = useAuth();

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

  // Buscar bloqueios de agenda
  const fetchBlockedDates = async () => {
    try {
      console.log('🔍 Buscando bloqueios de agenda...');
      const { data, error } = await supabase
        .from('bloqueios_agenda')
        .select('*')
        .eq('status', 'ativo')
        .order('data_inicio');

      if (error) throw error;
      setBlockedDates(data || []);
      console.log('📋 Bloqueios encontrados:', data);
    } catch (error) {
      console.error('Erro ao buscar bloqueios:', error);
      setBlockedDates([]);
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
      console.log('🚀 Criando agendamento:', formData);

      // Validações de dados obrigatórios mais rigorosas
      if (!formData.medicoId?.trim()) {
        throw new Error('Médico é obrigatório');
      }
      if (!formData.atendimentoId?.trim()) {
        throw new Error('Tipo de atendimento é obrigatório');
      }
      if (!formData.nomeCompleto?.trim()) {
        throw new Error('Nome completo é obrigatório');
      }
      if (formData.nomeCompleto.trim().length < 3) {
        throw new Error('Nome completo deve ter pelo menos 3 caracteres');
      }
      if (!formData.dataNascimento) {
        throw new Error('Data de nascimento é obrigatória');
      }
      if (!formData.convenio?.trim()) {
        throw new Error('Convênio é obrigatório');
      }
      if (!formData.celular?.trim()) {
        throw new Error('Celular é obrigatório');
      }
      
      // Validação de formato de celular brasileiro
      const celularRegex = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;
      if (!celularRegex.test(formData.celular)) {
        throw new Error('Formato de celular inválido. Use o formato (XX) XXXXX-XXXX');
      }
      
      if (!formData.dataAgendamento) {
        throw new Error('Data do agendamento é obrigatória');
      }
      if (!formData.horaAgendamento) {
        throw new Error('Hora do agendamento é obrigatória');
      }
      
      // Validar se o usuário está autenticado
      if (!user?.id) {
        throw new Error('Usuário não está autenticado');
      }

      // Validações de negócio
      const appointmentDateTime = new Date(`${formData.dataAgendamento}T${formData.horaAgendamento}`);
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      
      if (appointmentDateTime <= oneHourFromNow) {
        throw new Error('Agendamento deve ser feito com pelo menos 1 hora de antecedência');
      }

      // Validar idade do paciente
      const birthDate = new Date(formData.dataNascimento);
      const age = Math.floor((now.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      
      if (age < 0 || age > 120) {
        throw new Error('Data de nascimento inválida');
      }

      // Buscar informações do médico para validações
      const selectedDoctor = doctors.find(d => d.id === formData.medicoId);
      if (!selectedDoctor) {
        throw new Error('Médico selecionado não encontrado');
      }

      // Validar se médico está ativo
      if (!selectedDoctor.ativo) {
        throw new Error('Médico selecionado não está ativo');
      }

      // Validar idade vs médico
      if (selectedDoctor.idade_minima && age < selectedDoctor.idade_minima) {
        throw new Error(`Paciente muito jovem para este médico (mínimo: ${selectedDoctor.idade_minima} anos)`);
      }
      if (selectedDoctor.idade_maxima && age > selectedDoctor.idade_maxima) {
        throw new Error(`Paciente muito idoso para este médico (máximo: ${selectedDoctor.idade_maxima} anos)`);
      }

      // Validar convênio aceito
      if (selectedDoctor.convenios_aceitos && selectedDoctor.convenios_aceitos.length > 0) {
        if (!selectedDoctor.convenios_aceitos.includes(formData.convenio)) {
          throw new Error(`Convênio "${formData.convenio}" não é aceito por este médico`);
        }
      }

      console.log('✅ Validações rigorosas passaram, verificando disponibilidade...');

      // Verificar conflitos em paralelo (mais eficiente)
      const [blockedResult, conflictResult] = await Promise.all([
        supabase
          .from('bloqueios_agenda')
          .select('id, motivo')
          .eq('medico_id', formData.medicoId)
          .eq('status', 'ativo')
          .lte('data_inicio', formData.dataAgendamento)
          .gte('data_fim', formData.dataAgendamento)
          .maybeSingle(),
        
        supabase
          .from('agendamentos')
          .select('id, pacientes(nome_completo)')
          .eq('medico_id', formData.medicoId)
          .eq('data_agendamento', formData.dataAgendamento)
          .eq('hora_agendamento', formData.horaAgendamento)
          .in('status', ['agendado', 'confirmado'])
          .maybeSingle()
      ]);

      if (blockedResult.error) {
        console.error('❌ Erro ao verificar bloqueios:', blockedResult.error);
        throw new Error('Erro ao verificar disponibilidade da agenda');
      }

      if (blockedResult.data) {
        throw new Error(`A agenda está bloqueada nesta data. Motivo: ${blockedResult.data.motivo}`);
      }

      if (conflictResult.error) {
        console.error('❌ Erro ao verificar conflitos:', conflictResult.error);
        throw new Error('Erro ao verificar disponibilidade do horário');
      }

      if (conflictResult.data) {
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
          celular: formData.celular || '', // Garantir que nunca seja null
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
          criado_por: 'recepcionista', // Usar valor que atende ao constraint
          criado_por_user_id: user?.id,
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
      await Promise.all([fetchDoctors(), fetchAtendimentos(), fetchAppointments(), fetchBlockedDates()]);
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
      throw error; // Relançar erro para manter dados do formulário
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

  // Verificar se uma data está bloqueada para um médico
  const isDateBlocked = (doctorId: string, date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return blockedDates.some(blocked => 
      blocked.medico_id === doctorId &&
      blocked.status === 'ativo' &&
      dateStr >= blocked.data_inicio &&
      dateStr <= blocked.data_fim
    );
  };

  // Obter bloqueios para um médico específico
  const getBlockedDatesByDoctor = (doctorId: string) => {
    return blockedDates.filter(blocked => 
      blocked.medico_id === doctorId && blocked.status === 'ativo'
    );
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchDoctors(),
        fetchAtendimentos(),
        fetchAppointments(),
        fetchBlockedDates(),
      ]);
      setLoading(false);
    };

    loadData();
  }, []);

  return {
    doctors,
    atendimentos,
    appointments,
    blockedDates,
    loading,
    createAppointment,
    cancelAppointment,
    searchPatientsByBirthDate,
    getAtendimentosByDoctor,
    getAppointmentsByDoctorAndDate,
    isDateBlocked,
    getBlockedDatesByDoctor,
    refetch: () => Promise.all([fetchDoctors(), fetchAtendimentos(), fetchAppointments(), fetchBlockedDates()]),
  };
}