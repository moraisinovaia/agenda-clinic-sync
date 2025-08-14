
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Doctor, Atendimento } from '@/types/scheduling';

export function useSchedulingData() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError(null);
    } catch (error) {
      console.error('Erro ao buscar médicos:', error);
      setError('Erro ao carregar médicos');
      setDoctors([]);
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
      setAtendimentos([]);
    }
  };

  // Buscar bloqueios de agenda
  const fetchBlockedDates = async () => {
    try {
      const { data, error } = await supabase
        .from('bloqueios_agenda')
        .select('*')
        .eq('status', 'ativo')
        .order('data_inicio');

      if (error) throw error;
      setBlockedDates(data || []);
    } catch (error) {
      console.error('Erro ao buscar bloqueios:', error);
      setBlockedDates([]);
    }
  };

  // Buscar atendimentos por médico
  const getAtendimentosByDoctor = (doctorId: string) => {
    return atendimentos.filter(atendimento => atendimento.medico_id === doctorId);
  };

  // Verificar se médico trabalha no dia da semana
  const isDoctorWorkingDay = (doctorId: string, date: Date) => {
    const doctor = doctors.find(d => d.id === doctorId);
    if (!doctor?.horarios) return true; // Se não tem horários definidos, assume que trabalha

    const dayOfWeek = date.getDay(); // 0=domingo, 1=segunda, ..., 6=sábado
    const dayNames = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const dayName = dayNames[dayOfWeek];
    
    return doctor.horarios[dayName] && doctor.horarios[dayName].length > 0;
  };

  // Verificar se uma data está bloqueada para um médico (inclui validação de dias da semana)
  const isDateBlocked = (doctorId: string, date: Date) => {
    // Primeiro verifica se o médico trabalha neste dia da semana
    if (!isDoctorWorkingDay(doctorId, date)) {
      return true;
    }

    // Depois verifica bloqueios explícitos
    const dateStr = date.toISOString().split('T')[0];
    return blockedDates.some(blocked => 
      blocked.medico_id === doctorId &&
      blocked.status === 'ativo' &&
      dateStr >= blocked.data_inicio &&
      dateStr <= blocked.data_fim
    );
  };

  // Obter motivo específico do bloqueio
  const getBlockingReason = (doctorId: string, date: Date) => {
    const doctor = doctors.find(d => d.id === doctorId);
    
    // Verificar se médico trabalha neste dia
    if (!isDoctorWorkingDay(doctorId, date)) {
      const dayNames = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
      const dayName = dayNames[date.getDay()];
      return {
        type: 'no_working_day',
        message: `${doctor?.nome || 'Médico'} não atende às ${dayName}s`
      };
    }

    // Verificar bloqueios explícitos
    const dateStr = date.toISOString().split('T')[0];
    const blocked = blockedDates.find(blocked => 
      blocked.medico_id === doctorId &&
      blocked.status === 'ativo' &&
      dateStr >= blocked.data_inicio &&
      dateStr <= blocked.data_fim
    );

    if (blocked) {
      return {
        type: 'explicit_block',
        message: blocked.motivo || 'Data bloqueada na agenda'
      };
    }

    return null;
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
      try {
        await Promise.all([
          fetchDoctors(),
          fetchAtendimentos(),
          fetchBlockedDates(),
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return {
    doctors,
    atendimentos,
    blockedDates,
    loading,
    error,
    getAtendimentosByDoctor,
    isDateBlocked,
    getBlockedDatesByDoctor,
    isDoctorWorkingDay,
    getBlockingReason,
    refetch: () => Promise.all([fetchDoctors(), fetchAtendimentos(), fetchBlockedDates()]),
  };
}
