
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Doctor, Atendimento } from '@/types/scheduling';
import { useToast } from '@/hooks/use-toast';

export function useSchedulingData() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
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

  // Verificar se uma data está bloqueada para um médico - CORRIGIDA A ASSINATURA
  const isDateBlocked = (date: string, doctorId: string) => {
    return blockedDates.some(blocked => 
      blocked.medico_id === doctorId &&
      blocked.status === 'ativo' &&
      date >= blocked.data_inicio &&
      date <= blocked.data_fim
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
    getAtendimentosByDoctor,
    isDateBlocked,
    getBlockedDatesByDoctor,
    refetch: () => Promise.all([fetchDoctors(), fetchAtendimentos(), fetchBlockedDates()]),
  };
}
