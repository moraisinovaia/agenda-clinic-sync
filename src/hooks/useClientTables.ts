import { useMemo, useState, useCallback } from 'react';
import { useStableAuth } from '@/hooks/useStableAuth';
import { supabase } from '@/integrations/supabase/client';

export interface ClientTables {
  medicos: string;
  pacientes: string;
  agendamentos: string;
  atendimentos: string;
  bloqueios_agenda: string;
  fila_espera: string;
  preparos: string;
  profiles: string;
}

export function useClientTables() {
  const { profile, isSuperAdmin } = useStableAuth();
  const [selectedClient, setSelectedClient] = useState<'INOVAIA' | 'IPADO' | null>(() => {
    // Recuperar seleção persistida do localStorage para super-admin
    if (typeof window !== 'undefined' && isSuperAdmin) {
      const saved = localStorage.getItem('superadmin_selected_client');
      return saved as ('INOVAIA' | 'IPADO') | null;
    }
    return null;
  });

  // Função para setar cliente com persistência
  const setSelectedClientWithPersistence = useCallback((client: 'INOVAIA' | 'IPADO' | null) => {
    setSelectedClient(client);
    if (typeof window !== 'undefined' && isSuperAdmin) {
      if (client) {
        localStorage.setItem('superadmin_selected_client', client);
      } else {
        localStorage.removeItem('superadmin_selected_client');
      }
    }
  }, [isSuperAdmin]);

  // Check if user belongs to IPADO client with improved error handling
  const checkClientType = useCallback(async (): Promise<boolean> => {
    // Super admin bypass - não precisa verificar cliente
    if (isSuperAdmin) {
      console.log('🔑 Super-admin detectado - usando cliente selecionado:', selectedClient);
      return selectedClient === 'IPADO';
    }

    // Se não tem cliente_id, assumir INOVAIA
    if (!profile?.cliente_id) {
      console.log('⚠️ Sem cliente_id definido - assumindo INOVAIA');
      return false;
    }
    
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('nome')
        .eq('id', profile.cliente_id)
        .single();
      
      if (error) {
        console.error('❌ Erro ao verificar tipo do cliente:', error);
        // Fallback: assumir INOVAIA se houver erro
        console.log('🔄 Fallback: assumindo INOVAIA devido ao erro');
        return false;
      }
      
      const isIpado = data?.nome === 'IPADO';
      console.log(`🏥 Cliente verificado: ${isIpado ? 'IPADO' : 'INOVAIA'}`, { profile: profile?.email });
      return isIpado;
    } catch (error) {
      console.error('❌ Erro crítico ao verificar tipo do cliente:', error);
      // Fallback crítico: assumir INOVAIA
      console.log('🔄 Fallback crítico: assumindo INOVAIA');
      return false;
    }
  }, [profile?.cliente_id, isSuperAdmin, selectedClient]);

  // Get table names based on client
  const getTableNames = (isIpado: boolean): ClientTables => {
    const prefix = isIpado ? 'ipado_' : '';
    
    return {
      medicos: `${prefix}medicos`,
      pacientes: `${prefix}pacientes`,
      agendamentos: `${prefix}agendamentos`,
      atendimentos: `${prefix}atendimentos`,
      bloqueios_agenda: `${prefix}bloqueios_agenda`,
      fila_espera: `${prefix}fila_espera`,
      preparos: `${prefix}preparos`,
      profiles: isIpado ? 'ipado_profiles' : 'profiles'
    };
  };

  // Memoized function to get tables for current user with improved error handling
  const getTables = useCallback(async (): Promise<ClientTables> => {
    try {
      // Super admin pode escolher o cliente
      if (isSuperAdmin) {
        if (selectedClient) {
          const isIpado = selectedClient === 'IPADO';
          console.log(`🔑 Super-admin acessando: ${selectedClient}`);
          return getTableNames(isIpado);
        } else {
          // Super admin sem cliente selecionado - padrão INOVAIA
          console.log('🔑 Super-admin sem cliente selecionado - usando INOVAIA como padrão');
          return getTableNames(false);
        }
      }
      
      // Usuário normal - detectar cliente automaticamente
      const isIpado = await checkClientType();
      return getTableNames(isIpado);
    } catch (error) {
      console.error('❌ Erro crítico em getTables:', error);
      // Fallback final: sempre retornar INOVAIA
      console.log('🔄 Fallback final: retornando tabelas INOVAIA');
      return getTableNames(false);
    }
  }, [profile?.cliente_id, isSuperAdmin, selectedClient, checkClientType]);

  return {
    getTables,
    checkClientType,
    getTableNames,
    isSuperAdmin,
    selectedClient,
    setSelectedClient: setSelectedClientWithPersistence
  };
}