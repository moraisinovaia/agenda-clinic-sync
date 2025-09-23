
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useStableAuth } from '@/hooks/useStableAuth';
import { useClientTables } from '@/hooks/useClientTables';

export function useSchedulingData() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [atendimentos, setAtendimentos] = useState<any[]>([]);
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTables, setCurrentTables] = useState<any>(null);
  
  const { profile, isSuperAdmin } = useStableAuth();
  const { getTables } = useClientTables();

  // Função robusta para obter as tabelas corretas
  const getCurrentTables = useCallback(async () => {
    try {
      console.log('🔍 Obtendo configuração de tabelas...');
      const tables = await getTables();
      console.log('✅ Tabelas obtidas:', tables);
      setCurrentTables(tables);
      return tables;
    } catch (error) {
      console.error('❌ Erro ao obter tabelas:', error);
      // Fallback: usar tabelas INOVAIA como padrão
      const fallbackTables = {
        medicos: 'medicos',
        atendimentos: 'atendimentos',
        bloqueios_agenda: 'bloqueios_agenda',
        pacientes: 'pacientes',
        agendamentos: 'agendamentos',
        fila_espera: 'fila_espera',
        preparos: 'preparos',
        profiles: 'profiles'
      };
      console.log('🔄 Usando fallback - tabelas INOVAIA');
      setCurrentTables(fallbackTables);
      return fallbackTables;
    }
  }, [getTables]);

  // Buscar médicos ativos usando as tabelas corretas
  const fetchDoctors = async (tables: any) => {
    if (!tables) return;
    
    try {
      const tableName = tables.medicos;
      console.log(`🏥 Buscando médicos da tabela: ${tableName}`);
      
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setDoctors(data || []);
      setError(null);
      console.log(`✅ Encontrados ${data?.length || 0} médicos na tabela ${tableName}`);
    } catch (error) {
      console.error('Erro ao buscar médicos:', error);
      setError('Erro ao carregar médicos');
      setDoctors([]);
    }
  };

  // Buscar atendimentos ativos usando as tabelas corretas
  const fetchAtendimentos = async (tables: any) => {
    if (!tables) return;
    
    try {
      const tableName = tables.atendimentos;
      console.log(`🏥 Buscando atendimentos da tabela: ${tableName}`);
      
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setAtendimentos(data || []);
      console.log(`✅ Encontrados ${data?.length || 0} atendimentos na tabela ${tableName}`);
    } catch (error) {
      console.error('Erro ao buscar atendimentos:', error);
      setAtendimentos([]);
    }
  };

  // Buscar bloqueios de agenda usando as tabelas corretas
  const fetchBlockedDates = async (tables: any) => {
    if (!tables) return;
    
    try {
      const tableName = tables.bloqueios_agenda;
      console.log(`🏥 Buscando bloqueios da tabela: ${tableName}`);
      
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('status', 'ativo')
        .order('data_inicio');

      if (error) throw error;
      setBlockedDates(data || []);
      console.log(`✅ Encontrados ${data?.length || 0} bloqueios na tabela ${tableName}`);
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

  // Carregar dados iniciais com tratamento robusto para super-admin
  useEffect(() => {
    const initializeData = async () => {
      console.log('🚀 Iniciando carregamento de dados...');
      console.log('👤 Profile:', { 
        cliente_id: profile?.cliente_id, 
        email: profile?.email, 
        isSuperAdmin 
      });

      setLoading(true);
      setError(null);
      
      try {
        // Para super-admin ou usuários sem cliente_id, tentar obter tabelas via useClientTables
        if (isSuperAdmin || !profile?.cliente_id) {
          console.log('🔑 Super-admin ou usuário sem cliente_id - usando getTables()');
          const tables = await getCurrentTables();
          if (tables) {
            await Promise.all([
              fetchDoctors(tables),
              fetchAtendimentos(tables),
              fetchBlockedDates(tables),
            ]);
          }
        } else {
          // Usuário normal com cliente_id - obter tabelas também
          console.log('👤 Usuário normal com cliente_id - usando getTables()');
          const tables = await getCurrentTables();
          if (tables) {
            await Promise.all([
              fetchDoctors(tables),
              fetchAtendimentos(tables),
              fetchBlockedDates(tables),
            ]);
          }
        }
      } catch (error) {
        console.error('❌ Erro durante inicialização:', error);
        setError('Erro ao carregar dados do sistema');
      } finally {
        setLoading(false);
        console.log('✅ Carregamento de dados finalizado');
      }
    };

    // Sempre executar inicialização se há profile (mesmo sem cliente_id)
    if (profile) {
      initializeData();
    }
  }, [profile, isSuperAdmin, getCurrentTables]);

  // Recarregar quando as tabelas mudarem (super-admin trocando cliente)
  useEffect(() => {
    const reloadData = async () => {
      if (currentTables && !loading) {
        console.log('🔄 Tabelas mudaram - recarregando dados...');
        try {
          await Promise.all([
            fetchDoctors(currentTables),
            fetchAtendimentos(currentTables),
            fetchBlockedDates(currentTables),
          ]);
        } catch (error) {
          console.error('❌ Erro ao recarregar dados:', error);
        }
      }
    };

    reloadData();
  }, [currentTables]);

  return {
    doctors,
    atendimentos,
    blockedDates,
    loading,
    error,
    getAtendimentosByDoctor,
    isDateBlocked,
    getBlockedDatesByDoctor,
    refetch: async () => {
      console.log('🔄 Refetch solicitado...');
      if (currentTables) {
        console.log('📊 Recarregando dados com tabelas:', currentTables);
        return Promise.all([
          fetchDoctors(currentTables), 
          fetchAtendimentos(currentTables), 
          fetchBlockedDates(currentTables)
        ]);
      } else {
        console.log('🔄 Sem tabelas definidas - obtendo configuração...');
        const tables = await getCurrentTables();
        if (tables) {
          return Promise.all([
            fetchDoctors(tables), 
            fetchAtendimentos(tables), 
            fetchBlockedDates(tables)
          ]);
        }
      }
      console.log('❌ Refetch falhou - sem configuração de tabelas');
      return Promise.resolve();
    },
  };
}
