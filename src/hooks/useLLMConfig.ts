import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useStableAuth } from '@/hooks/useStableAuth';

export interface LLMClinicConfig {
  id: string;
  cliente_id: string;
  nome_clinica: string;
  telefone: string | null;
  whatsapp: string | null;
  endereco: string | null;
  data_minima_agendamento: string | null;
  mensagem_bloqueio_padrao: string | null;
  dias_busca_inicial: number;
  dias_busca_expandida: number;
  ativo: boolean;
}

export interface BusinessRule {
  id: string;
  cliente_id: string;
  config_id?: string;
  medico_id: string;
  config: any;
  ativo: boolean;
  version: number;
  medico_nome?: string;
}

export interface LLMMensagem {
  id: string;
  cliente_id: string;
  config_id?: string;
  medico_id: string | null;
  tipo: string;
  mensagem: string;
  ativo: boolean;
}

export function useLLMConfig(clienteId: string | null) {
  const { toast } = useToast();
  const { profile } = useStableAuth();
  
  // Multi-config states
  const [allConfigs, setAllConfigs] = useState<LLMClinicConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [clinicConfig, setClinicConfig] = useState<LLMClinicConfig | null>(null);
  const [businessRules, setBusinessRules] = useState<BusinessRule[]>([]);
  const [mensagens, setMensagens] = useState<LLMMensagem[]>([]);
  const [medicos, setMedicos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const effectiveClienteId = clienteId || profile?.cliente_id;

  // Fetch all clinic configs for this cliente
  const fetchAllConfigs = useCallback(async () => {
    if (!effectiveClienteId) return;
    
    const { data, error } = await supabase
      .from('llm_clinic_config')
      .select('*')
      .eq('cliente_id', effectiveClienteId)
      .eq('ativo', true)
      .order('nome_clinica');
    
    if (error) {
      console.error('Erro ao buscar configs:', error);
      return;
    }
    
    setAllConfigs(data || []);
    
    // Select first config if none selected
    if (data && data.length > 0 && !selectedConfigId) {
      setSelectedConfigId(data[0].id);
      setClinicConfig(data[0]);
    }
  }, [effectiveClienteId, selectedConfigId]);

  // Update clinicConfig when selectedConfigId changes
  useEffect(() => {
    if (selectedConfigId && allConfigs.length > 0) {
      const config = allConfigs.find(c => c.id === selectedConfigId);
      setClinicConfig(config || null);
    }
  }, [selectedConfigId, allConfigs]);

  // Fetch business rules filtered by config_id
  const fetchBusinessRules = useCallback(async () => {
    if (!selectedConfigId) return;
    
    const { data, error } = await supabase
      .from('business_rules')
      .select('*, medico:medicos(nome)')
      .eq('config_id', selectedConfigId)
      .eq('ativo', true)
      .order('created_at');
    
    if (error) {
      console.error('Erro ao buscar business rules:', error);
      return;
    }
    
    // Transform to include medico_nome
    const transformedData = (data || []).map(rule => ({
      ...rule,
      medico_nome: rule.medico?.nome || 'N/A'
    }));
    
    setBusinessRules(transformedData as BusinessRule[]);
  }, [selectedConfigId]);

  // Fetch mensagens filtered by config_id
  const fetchMensagens = useCallback(async () => {
    if (!selectedConfigId) return;
    
    const { data, error } = await supabase
      .from('llm_mensagens')
      .select('*')
      .eq('config_id', selectedConfigId)
      .order('tipo');
    
    if (error) {
      console.error('Erro ao buscar mensagens:', error);
      return;
    }
    
    setMensagens(data || []);
  }, [selectedConfigId]);

  // Fetch medicos
  const fetchMedicos = useCallback(async () => {
    if (!effectiveClienteId) return;
    
    const { data, error } = await supabase
      .from('medicos')
      .select('id, nome, especialidade, ativo')
      .eq('cliente_id', effectiveClienteId)
      .eq('ativo', true)
      .order('nome');
    
    if (error) {
      console.error('Erro ao buscar médicos:', error);
      return;
    }
    
    setMedicos(data || []);
  }, [effectiveClienteId]);

  // Load initial data (configs + medicos)
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      await Promise.all([
        fetchAllConfigs(),
        fetchMedicos()
      ]);
      setLoading(false);
    };

    if (effectiveClienteId) {
      loadInitialData();
    }
  }, [effectiveClienteId, fetchAllConfigs, fetchMedicos]);

  // Load config-specific data when selectedConfigId changes
  useEffect(() => {
    const loadConfigData = async () => {
      if (!selectedConfigId) return;
      await Promise.all([
        fetchBusinessRules(),
        fetchMensagens()
      ]);
    };

    loadConfigData();
  }, [selectedConfigId, fetchBusinessRules, fetchMensagens]);

  // Save clinic config
  const saveClinicConfig = async (data: Partial<LLMClinicConfig>) => {
    if (!effectiveClienteId || !selectedConfigId) return false;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('llm_clinic_config')
        .update(data)
        .eq('id', selectedConfigId);
      
      if (error) throw error;
      
      toast({ title: 'Configuração salva com sucesso!' });
      await fetchAllConfigs();
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Save business rule with config_id
  const saveBusinessRule = async (medicoId: string, config: any) => {
    if (!effectiveClienteId || !selectedConfigId) return false;
    
    setSaving(true);
    try {
      const existing = businessRules.find(r => r.medico_id === medicoId);
      
      if (existing) {
        const { error } = await supabase
          .from('business_rules')
          .update({ config, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('business_rules')
          .insert({
            cliente_id: effectiveClienteId,
            config_id: selectedConfigId,
            medico_id: medicoId,
            config,
            ativo: true,
            version: 1
          });
        
        if (error) throw error;
      }
      
      toast({ title: 'Regra salva com sucesso!' });
      await fetchBusinessRules();
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao salvar regra', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Delete business rule
  const deleteBusinessRule = async (ruleId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('business_rules')
        .delete()
        .eq('id', ruleId);
      
      if (error) throw error;
      
      toast({ title: 'Regra excluída com sucesso!' });
      await fetchBusinessRules();
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao excluir regra', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Save mensagem with config_id
  const saveMensagem = async (data: Partial<LLMMensagem>) => {
    if (!effectiveClienteId || !selectedConfigId) return false;
    
    setSaving(true);
    try {
      if (data.id) {
        const { error } = await supabase
          .from('llm_mensagens')
          .update({ mensagem: data.mensagem, tipo: data.tipo, medico_id: data.medico_id, ativo: data.ativo })
          .eq('id', data.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('llm_mensagens')
          .insert([{ 
            mensagem: data.mensagem!, 
            tipo: data.tipo!, 
            medico_id: data.medico_id, 
            cliente_id: effectiveClienteId, 
            config_id: selectedConfigId,
            ativo: true 
          }]);
        
        if (error) throw error;
      }
      
      toast({ title: 'Mensagem salva com sucesso!' });
      await fetchMensagens();
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao salvar mensagem', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Delete mensagem
  const deleteMensagem = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('llm_mensagens')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({ title: 'Mensagem excluída com sucesso!' });
      await fetchMensagens();
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao excluir mensagem', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Create new config
  const createNewConfig = async (data: Partial<LLMClinicConfig>) => {
    if (!effectiveClienteId) return false;
    
    setSaving(true);
    try {
      const { data: newConfig, error } = await supabase
        .from('llm_clinic_config')
        .insert([{ 
          ...data, 
          cliente_id: effectiveClienteId, 
          nome_clinica: data.nome_clinica || 'Nova Clínica',
          ativo: true 
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      toast({ title: 'Nova configuração criada com sucesso!' });
      await fetchAllConfigs();
      
      // Select the new config
      if (newConfig) {
        setSelectedConfigId(newConfig.id);
      }
      
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao criar configuração', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    // Multi-config
    allConfigs,
    selectedConfigId,
    setSelectedConfigId,
    // Current config data
    clinicConfig,
    businessRules,
    mensagens,
    medicos,
    loading,
    saving,
    // Actions
    saveClinicConfig,
    saveBusinessRule,
    deleteBusinessRule,
    saveMensagem,
    deleteMensagem,
    createNewConfig,
    refetch: () => Promise.all([fetchAllConfigs(), fetchBusinessRules(), fetchMensagens()])
  };
}
