import { useMemo, useState } from 'react';
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
  const [selectedClient, setSelectedClient] = useState<'INOVAIA' | 'IPADO' | null>(null);

  // Check if user belongs to IPADO client
  const checkClientType = async (): Promise<boolean> => {
    if (!profile?.cliente_id) return false;
    
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('nome')
        .eq('id', profile.cliente_id)
        .single();
      
      if (error) {
        console.error('❌ Erro ao verificar tipo do cliente:', error);
        return false;
      }
      
      return data?.nome === 'IPADO';
    } catch (error) {
      console.error('❌ Erro ao verificar tipo do cliente:', error);
      return false;
    }
  };

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

  // Memoized function to get tables for current user
  const getTables = useMemo(() => async (): Promise<ClientTables> => {
    // Super admin pode escolher o cliente
    if (isSuperAdmin && selectedClient) {
      const isIpado = selectedClient === 'IPADO';
      console.log(`🏥 Super-admin acessando: ${selectedClient}`);
      return getTableNames(isIpado);
    }
    
    // Usuário normal - detectar cliente automaticamente
    const isIpado = await checkClientType();
    console.log(`🏥 Cliente detectado: ${isIpado ? 'IPADO' : 'INOVAIA'}`);
    return getTableNames(isIpado);
  }, [profile?.cliente_id, isSuperAdmin, selectedClient]);

  return {
    getTables,
    checkClientType,
    getTableNames,
    isSuperAdmin,
    selectedClient,
    setSelectedClient
  };
}