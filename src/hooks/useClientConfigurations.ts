import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useStableAuth } from './useStableAuth';
import { toast } from 'sonner';

interface ClientConfiguration {
  id: string;
  cliente_id: string;
  category: string;
  key: string;
  value: string;
  value_type: string;
  description: string | null;
  editable: boolean;
  created_at: string;
  updated_at: string;
}

export const useClientConfigurations = () => {
  const [configurations, setConfigurations] = useState<ClientConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useStableAuth();

  const fetchConfigurations = async () => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('client_configurations')
        .select('*')
        .order('category', { ascending: true })
        .order('key', { ascending: true });

      if (error) throw error;
      setConfigurations(data || []);
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const updateConfiguration = async (id: string, value: string) => {
    try {
      const { error } = await supabase
        .from('client_configurations')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      await fetchConfigurations();
      toast.success('Configuração atualizada com sucesso');
    } catch (error) {
      console.error('Erro ao atualizar configuração:', error);
      toast.error('Erro ao atualizar configuração');
    }
  };

  const getConfigurationByKey = (category: string, key: string): string | null => {
    const config = configurations.find(c => c.category === category && c.key === key);
    return config?.value || null;
  };

  const getConfigurationsByCategory = (category: string): ClientConfiguration[] => {
    return configurations.filter(c => c.category === category);
  };

  useEffect(() => {
    fetchConfigurations();
  }, [isAuthenticated]);

  return {
    configurations,
    loading,
    updateConfiguration,
    getConfigurationByKey,
    getConfigurationsByCategory,
    refetch: fetchConfigurations
  };
};