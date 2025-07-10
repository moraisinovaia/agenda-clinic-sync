import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppointmentWithRelations } from '@/types/scheduling';
import { useToast } from '@/hooks/use-toast';

export function useAppointmentsList() {
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Buscar agendamentos - versão simplificada para evitar problemas
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
      setAppointments([]);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os agendamentos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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
    const loadAppointments = async () => {
      setLoading(true);
      await fetchAppointments();
    };
    
    loadAppointments();
  }, []);

  return {
    appointments,
    loading,
    getAppointmentsByDoctorAndDate,
    cancelAppointment,
    refetch: fetchAppointments,
  };
}