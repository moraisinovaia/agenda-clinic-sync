
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Doctor, Atendimento } from '@/types/scheduling';

export function useSchedulingData() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar médicos ativos com melhor tratamento de erro
  const fetchDoctors = async () => {
    try {
      console.log('🔍 Buscando médicos...');
      
      // First try with RLS
      let { data, error } = await supabase
        .from('medicos')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      // If RLS fails, try direct query (public access policy should work)
      if (error && error.code === '42501') {
        console.log('⚠️ RLS failed, trying direct query...');
        const { data: directData, error: directError } = await supabase
          .from('medicos')
          .select('*')
          .eq('ativo', true)
          .order('nome');
        
        data = directData;
        error = directError;
      }

      if (error) {
        console.error('❌ Erro final ao buscar médicos:', error);
        throw error;
      }
      
      console.log('✅ Médicos encontrados:', data?.length || 0);
      setDoctors(data || []);
      setError(null);
    } catch (error: any) {
      console.error('💥 Erro ao buscar médicos:', error);
      
      // Set specific error messages based on error type
      if (error?.code === '42501') {
        setError('Erro de permissão - verificar configurações');
      } else if (error?.message?.includes('connection')) {
        setError('Erro de conexão - tentando reconectar...');
      } else {
        setError('Erro ao carregar médicos');
      }
      
      setDoctors([]);
    }
  };

  // Buscar atendimentos ativos com melhor tratamento de erro
  const fetchAtendimentos = async () => {
    try {
      console.log('🔍 Buscando atendimentos...');
      
      const { data, error } = await supabase
        .from('atendimentos')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) {
        console.error('❌ Erro ao buscar atendimentos:', error);
        throw error;
      }
      
      console.log('✅ Atendimentos encontrados:', data?.length || 0);
      setAtendimentos(data || []);
    } catch (error) {
      console.error('💥 Erro ao buscar atendimentos:', error);
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
    refetch: () => Promise.all([fetchDoctors(), fetchAtendimentos(), fetchBlockedDates()]),
  };
}
