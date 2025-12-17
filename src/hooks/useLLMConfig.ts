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
  medico_id: string;
  config: any;
  ativo: boolean;
  version: number;
  medico_nome?: string;
}

export interface LLMMensagem {
  id: string;
  cliente_id: string;
  medico_id: string | null;
  tipo: string;
  mensagem: string;
  ativo: boolean;
}

export function useLLMConfig(clienteId: string | null) {
  const { toast } = useToast();
  const { profile } = useStableAuth();
  
  const [clinicConfig, setClinicConfig] = useState<LLMClinicConfig | null>(null);
  const [businessRules, setBusinessRules] = useState<BusinessRule[]>([]);
  const [mensagens, setMensagens] = useState<LLMMensagem[]>([]);
  const [medicos, setMedicos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const effectiveClienteId = clienteId || profile?.cliente_id;

  // Fetch clinic config
  const fetchClinicConfig = useCallback(async () => {
    if (!effectiveClienteId) return;
    
    const { data, error } = await supabase
      .from('llm_clinic_config')
      .select('*')
      .eq('cliente_id', effectiveClienteId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao buscar config:', error);
    }
    setClinicConfig(data);
  }, [effectiveClienteId]);

  // Fetch business rules with doctor names
  const fetchBusinessRules = useCallback(async () => {
    if (!effectiveClienteId) return;
    
    const { data, error } = await supabase.rpc('get_business_rules_by_cliente', {
      p_cliente_id: effectiveClienteId
    });
    
    if (error) {
      console.error('Erro ao buscar business rules:', error);
      return;
    }
    
    setBusinessRules((data || []) as BusinessRule[]);
  }, [effectiveClienteId]);

  // Fetch mensagens
  const fetchMensagens = useCallback(async () => {
    if (!effectiveClienteId) return;
    
    const { data, error } = await supabase
      .from('llm_mensagens')
      .select('*')
      .eq('cliente_id', effectiveClienteId)
      .order('tipo');
    
    if (error) {
      console.error('Erro ao buscar mensagens:', error);
      return;
    }
    
    setMensagens(data || []);
  }, [effectiveClienteId]);

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

  // Load all data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchClinicConfig(),
        fetchBusinessRules(),
        fetchMensagens(),
        fetchMedicos()
      ]);
      setLoading(false);
    };

    if (effectiveClienteId) {
      loadData();
    }
  }, [effectiveClienteId, fetchClinicConfig, fetchBusinessRules, fetchMensagens, fetchMedicos]);

  // Save clinic config
  const saveClinicConfig = async (data: Partial<LLMClinicConfig>) => {
    if (!effectiveClienteId) return false;
    
    setSaving(true);
    try {
      if (clinicConfig?.id) {
        const { error } = await supabase
          .from('llm_clinic_config')
          .update(data)
          .eq('id', clinicConfig.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('llm_clinic_config')
          .insert([{ ...data, cliente_id: effectiveClienteId, nome_clinica: data.nome_clinica || 'Clínica' }]);
        
        if (error) throw error;
      }
      
      toast({ title: 'Configuração salva com sucesso!' });
      await fetchClinicConfig();
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Save business rule
  const saveBusinessRule = async (medicoId: string, config: any) => {
    if (!effectiveClienteId) return false;
    
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

  // Save mensagem
  const saveMensagem = async (data: Partial<LLMMensagem>) => {
    if (!effectiveClienteId) return false;
    
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
          .insert([{ mensagem: data.mensagem!, tipo: data.tipo!, medico_id: data.medico_id, cliente_id: effectiveClienteId, ativo: true }]);
        
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

  return {
    clinicConfig,
    businessRules,
    mensagens,
    medicos,
    loading,
    saving,
    saveClinicConfig,
    saveBusinessRule,
    deleteBusinessRule,
    saveMensagem,
    deleteMensagem,
    refetch: () => Promise.all([fetchClinicConfig(), fetchBusinessRules(), fetchMensagens()])
  };
}
