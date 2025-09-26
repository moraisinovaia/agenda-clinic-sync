
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Doctor, Atendimento } from '@/types/scheduling';
import { logger } from '@/utils/logger';

export function useSchedulingData() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Função de retry com backoff exponencial
  const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3) => {
    let lastError;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < maxRetries) {
          const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
          logger.warn(`Tentativa ${i + 1}/${maxRetries + 1} falhou, tentando novamente em ${delay}ms`, error, 'SCHEDULING_DATA');
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  };

  // Buscar médicos ativos com retry
  const fetchDoctors = useCallback(async () => {
    try {
      logger.info('Buscando médicos ativos', {}, 'SCHEDULING_DATA');
      
      const result = await retryWithBackoff(async () => {
        const { data, error } = await supabase
          .from('medicos')
          .select('*')
          .eq('ativo', true)
          .order('nome');

        if (error) throw error;
        return data;
      });

      setDoctors(result || []);
      setError(null);
      logger.info(`${result?.length || 0} médicos carregados`, {}, 'SCHEDULING_DATA');
    } catch (error) {
      logger.error('Erro ao buscar médicos após todas as tentativas', error, 'SCHEDULING_DATA');
      setError('Erro ao carregar médicos. Tentando reconectar...');
      setDoctors([]);
    }
  }, []);

  // Buscar atendimentos ativos com retry
  const fetchAtendimentos = useCallback(async () => {
    try {
      logger.info('Buscando atendimentos ativos', {}, 'SCHEDULING_DATA');
      
      const result = await retryWithBackoff(async () => {
        const { data, error } = await supabase
          .from('atendimentos')
          .select('*')
          .eq('ativo', true)
          .order('nome');

        if (error) throw error;
        return data;
      });

      setAtendimentos(result || []);
      logger.info(`${result?.length || 0} atendimentos carregados`, {}, 'SCHEDULING_DATA');
    } catch (error) {
      logger.error('Erro ao buscar atendimentos após todas as tentativas', error, 'SCHEDULING_DATA');
      setAtendimentos([]);
    }
  }, []);

  // Buscar bloqueios de agenda com retry
  const fetchBlockedDates = useCallback(async () => {
    try {
      logger.info('Buscando bloqueios de agenda', {}, 'SCHEDULING_DATA');
      
      const result = await retryWithBackoff(async () => {
        const { data, error } = await supabase
          .from('bloqueios_agenda')
          .select('*')
          .eq('status', 'ativo')
          .order('data_inicio');

        if (error) throw error;
        return data;
      });

      setBlockedDates(result || []);
      logger.info(`${result?.length || 0} bloqueios carregados`, {}, 'SCHEDULING_DATA');
    } catch (error) {
      logger.error('Erro ao buscar bloqueios após todas as tentativas', error, 'SCHEDULING_DATA');
      setBlockedDates([]);
    }
  }, []);

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

  // Função de carregamento com monitoramento de tentativas
  const loadData = useCallback(async () => {
    setLoading(true);
    setRetryCount(prev => prev + 1);
    
    try {
      logger.info('Iniciando carregamento de dados do sistema', { tentativa: retryCount }, 'SCHEDULING_DATA');
      
      await Promise.all([
        fetchDoctors(),
        fetchAtendimentos(),
        fetchBlockedDates(),
      ]);

      logger.info('Carregamento de dados concluído com sucesso', {}, 'SCHEDULING_DATA');
      setError(null);
    } catch (error) {
      logger.error('Falha no carregamento geral dos dados', error, 'SCHEDULING_DATA');
      setError('Erro ao conectar com o sistema. Verificando conexão...');
    } finally {
      setLoading(false);
    }
  }, [fetchDoctors, fetchAtendimentos, fetchBlockedDates, retryCount]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    doctors,
    atendimentos,
    blockedDates,
    loading,
    error,
    retryCount,
    getAtendimentosByDoctor,
    isDateBlocked,
    getBlockedDatesByDoctor,
    refetch: loadData,
  };
}
