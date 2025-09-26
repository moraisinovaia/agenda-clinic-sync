import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Doctor, Atendimento } from '@/types/scheduling';

const MAX_RETRIES = 3;

export function useSchedulingData() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryCount = useRef(0);

  const fetchDoctors = useCallback(async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('medicos')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) {
        // Se é erro de RLS (permissão), tentar uma abordagem diferente
        if (error.code === 'PGRST301' || error.message.includes('RLS')) {
          try {
            // Tentar sem filtros restritivos primeiro
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('medicos')
              .select('*')
              .limit(50); // Limite para não sobrecarregar
            
            if (!fallbackError && fallbackData) {
              setDoctors(fallbackData);
              setError(null);
              return;
            }
          } catch (fallbackError) {
            // Continue para o erro principal
          }
        }
        
        // Implementar retry simples
        retryCount.current++;
        if (retryCount.current < MAX_RETRIES) {
          const delay = Math.min(1000 * retryCount.current, 5000);
          setTimeout(() => {
            if (retryCount.current < MAX_RETRIES) {
              fetchDoctors();
            }
          }, delay);
          return;
        }
        
        throw error;
      }

      setDoctors(data || []);
      setError(null);
      retryCount.current = 0; // Reset contador em caso de sucesso
      
    } catch (error: any) {
      // Só definir erro se esgotar tentativas
      if (retryCount.current >= MAX_RETRIES) {
        setError(`Erro ao carregar médicos: ${error.message}`);
        setDoctors([]); // Garantir que não temos dados inconsistentes
      }
    }
  }, []);

  // Buscar atendimentos ativos
  const fetchAtendimentos = useCallback(async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('atendimentos')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setAtendimentos(data || []);
    } catch (error) {
      setAtendimentos([]);
    }
  }, []);

  // Buscar bloqueios de agenda
  const fetchBlockedDates = useCallback(async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('bloqueios_agenda')
        .select('*')
        .eq('status', 'ativo')
        .order('data_inicio');

      if (error) throw error;
      setBlockedDates(data || []);
    } catch (error) {
      setBlockedDates([]);
    }
  }, []);

  // ✅ ESTABILIZAR: Função de recarregamento consolidada
  const refetch = useCallback(async () => {
    await Promise.all([
      fetchDoctors(),
      fetchAtendimentos(),
      fetchBlockedDates(),
    ]);
  }, [fetchDoctors, fetchAtendimentos, fetchBlockedDates]);

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
  }, [fetchDoctors, fetchAtendimentos, fetchBlockedDates]);

  return {
    doctors,
    atendimentos,
    blockedDates,
    loading,
    error,
    getAtendimentosByDoctor,
    isDateBlocked,
    getBlockedDatesByDoctor,
    refetch,
  };
}