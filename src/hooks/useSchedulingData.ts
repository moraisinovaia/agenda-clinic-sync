
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useStableAuth } from '@/hooks/useStableAuth';

export function useSchedulingData() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [atendimentos, setAtendimentos] = useState<any[]>([]);
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isIpadoClient, setIsIpadoClient] = useState<boolean | null>(null);
  
  const { profile } = useStableAuth();

  // Verificar se o usuário é do cliente IPADO
  const checkClientType = async () => {
    if (!profile?.cliente_id) return false;
    
    try {
      const { data: cliente, error } = await supabase
        .from('clientes')
        .select('nome')
        .eq('id', profile.cliente_id)
        .single();
        
      if (error) {
        console.error('Erro ao verificar tipo de cliente:', error);
        return false;
      }
      
      return cliente?.nome === 'IPADO';
    } catch (error) {
      console.error('Erro ao verificar tipo de cliente:', error);
      return false;
    }
  };

  // Buscar médicos ativos
  const fetchDoctors = async () => {
    try {
      const tableName = isIpadoClient ? 'ipado_medicos' : 'medicos';
      
      const { data, error } = await supabase
        .from(tableName)
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
      const tableName = isIpadoClient ? 'ipado_atendimentos' : 'atendimentos';
      
      const { data, error } = await supabase
        .from(tableName)
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
      const tableName = isIpadoClient ? 'ipado_bloqueios_agenda' : 'bloqueios_agenda';
      
      const { data, error } = await supabase
        .from(tableName)
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
    const initializeData = async () => {
      if (!profile?.cliente_id) return;
      
      setLoading(true);
      try {
        // Primeiro verificar o tipo de cliente
        const isIpado = await checkClientType();
        setIsIpadoClient(isIpado);
        
        console.log(`🏥 Cliente detectado: ${isIpado ? 'IPADO' : 'INOVAIA'}`);
        
        // Aguardar um frame para garantir que isIpadoClient foi atualizado
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Carregar dados usando as tabelas corretas
        await Promise.all([
          fetchDoctors(),
          fetchAtendimentos(),
          fetchBlockedDates(),
        ]);
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [profile?.cliente_id]);

  // Recarregar dados quando o tipo de cliente mudar
  useEffect(() => {
    if (isIpadoClient !== null && profile?.cliente_id) {
      Promise.all([
        fetchDoctors(),
        fetchAtendimentos(),
        fetchBlockedDates(),
      ]);
    }
  }, [isIpadoClient]);

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
