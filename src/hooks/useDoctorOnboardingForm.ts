import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import {
  DoctorOnboardingFormData,
  ServicoConfig,
  PreparoConfig,
  initialDoctorFormData,
  initialServicoConfig,
  initialPreparoConfig,
} from '@/types/doctor-onboarding';

interface UseDoctorOnboardingFormProps {
  clienteId: string | null;
  onSuccess?: () => void;
}

export function useDoctorOnboardingForm({ clienteId, onSuccess }: UseDoctorOnboardingFormProps) {
  const [formData, setFormData] = useState<DoctorOnboardingFormData>(initialDoctorFormData);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalSteps = 7;

  // Update a specific field
  const updateField = useCallback(<K extends keyof DoctorOnboardingFormData>(
    field: K,
    value: DoctorOnboardingFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  // Add a new service
  const addServico = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      servicos: [...prev.servicos, { ...initialServicoConfig }],
    }));
  }, []);

  // Update a specific service
  const updateServico = useCallback((index: number, servico: ServicoConfig) => {
    setFormData(prev => ({
      ...prev,
      servicos: prev.servicos.map((s, i) => i === index ? servico : s),
    }));
  }, []);

  // Remove a service
  const removeServico = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      servicos: prev.servicos.filter((_, i) => i !== index),
    }));
  }, []);

  // Add a new preparo
  const addPreparo = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      preparos: [...prev.preparos, { ...initialPreparoConfig }],
    }));
  }, []);

  // Update a specific preparo
  const updatePreparo = useCallback((index: number, preparo: PreparoConfig) => {
    setFormData(prev => ({
      ...prev,
      preparos: prev.preparos.map((p, i) => i === index ? preparo : p),
    }));
  }, []);

  // Remove a preparo
  const removePreparo = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      preparos: prev.preparos.filter((_, i) => i !== index),
    }));
  }, []);

  // Toggle convenio
  const toggleConvenio = useCallback((convenio: string) => {
    setFormData(prev => ({
      ...prev,
      convenios_aceitos: prev.convenios_aceitos.includes(convenio)
        ? prev.convenios_aceitos.filter(c => c !== convenio)
        : [...prev.convenios_aceitos, convenio],
    }));
  }, []);

  // Validate current step
  const validateStep = useCallback((step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 0: // Dados Básicos
        if (!formData.nome.trim()) {
          newErrors.nome = 'Nome é obrigatório';
        }
        if (!formData.especialidade.trim()) {
          newErrors.especialidade = 'Especialidade é obrigatória';
        }
        break;
      case 1: // Restrições de Idade
        if (formData.idade_minima !== null && formData.idade_maxima !== null) {
          if (formData.idade_minima > formData.idade_maxima) {
            newErrors.idade_minima = 'Idade mínima não pode ser maior que a máxima';
          }
        }
        break;
      case 2: // Convênios
        // Convênios são opcionais
        break;
      case 3: // Tipo de Agendamento
        // Sempre válido
        break;
      case 4: // Serviços
        if (formData.servicos.length === 0) {
          newErrors.servicos = 'Adicione pelo menos um serviço';
        } else {
          formData.servicos.forEach((servico, index) => {
            if (!servico.nome.trim()) {
              newErrors[`servico_${index}_nome`] = 'Nome do serviço é obrigatório';
            }
            if (servico.dias_atendimento.length === 0) {
              newErrors[`servico_${index}_dias`] = 'Selecione pelo menos um dia de atendimento';
            }
          });
        }
        break;
      case 5: // Observações
        // Observações são opcionais
        break;
      case 6: // Preparos
        formData.preparos.forEach((preparo, index) => {
          if (preparo.nome && !preparo.exame) {
            newErrors[`preparo_${index}_exame`] = 'Selecione o exame relacionado';
          }
        });
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Go to next step
  const nextStep = useCallback(() => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1));
    }
  }, [currentStep, validateStep, totalSteps]);

  // Go to previous step
  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  // Go to specific step
  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < totalSteps) {
      setCurrentStep(step);
    }
  }, [totalSteps]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormData(initialDoctorFormData);
    setCurrentStep(0);
    setErrors({});
  }, []);

  // Submit the form
  const submitForm = useCallback(async () => {
    if (!clienteId) {
      toast.error('Clínica não identificada');
      return false;
    }

    // Validate all steps
    for (let i = 0; i <= currentStep; i++) {
      if (!validateStep(i)) {
        setCurrentStep(i);
        toast.error('Por favor, corrija os erros antes de continuar');
        return false;
      }
    }

    setIsSubmitting(true);

    try {
      // 1. Create the doctor
      const conveniosFinal = [
        ...formData.convenios_aceitos,
        ...(formData.convenio_personalizado.trim() 
          ? formData.convenio_personalizado.split(',').map(c => c.trim().toUpperCase())
          : []
        ),
      ];

      const { data: medicoResult, error: medicoError } = await supabase.rpc('criar_medico', {
        p_cliente_id: clienteId,
        p_nome: formData.nome,
        p_especialidade: formData.especialidade,
        p_convenios_aceitos: conveniosFinal.length > 0 ? conveniosFinal : null,
        p_idade_minima: formData.idade_minima || 0,
        p_idade_maxima: formData.idade_maxima,
        p_observacoes: formData.observacoes_gerais || null,
      });

      if (medicoError) throw medicoError;
      
      const result = medicoResult as { success: boolean; medico_id?: string; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erro ao criar médico');
      }

      const medicoId = result.medico_id;
      if (!medicoId) throw new Error('ID do médico não retornado');

      // 2. Create atendimentos (services) for the doctor
      const atendimentosIds: string[] = [];
      for (const servico of formData.servicos) {
        const { data: atendimento, error: atendError } = await supabase
          .from('atendimentos')
          .insert({
            cliente_id: clienteId,
            medico_id: medicoId,
            nome: servico.nome,
            tipo: servico.tipo,
            ativo: true,
            observacoes: servico.mensagem_personalizada || null,
          })
          .select('id')
          .single();

        if (atendError) {
          console.error('Erro ao criar atendimento:', atendError);
        } else if (atendimento) {
          atendimentosIds.push(atendimento.id);
        }
      }

      // 3. Create business rules with complete configuration
      const businessRuleConfig = {
        tipo_agendamento: formData.tipo_agendamento,
        permite_agendamento_online: formData.permite_agendamento_online,
        idade_minima: formData.idade_minima,
        idade_maxima: formData.idade_maxima,
        atende_criancas: formData.atende_criancas,
        atende_adultos: formData.atende_adultos,
        convenios: conveniosFinal,
        convenios_restricoes: formData.convenios_restricoes,
        observacoes: formData.observacoes_gerais,
        regras_especiais: formData.regras_especiais,
        restricoes_gerais: formData.restricoes_gerais,
        servicos: formData.servicos.map(s => ({
          nome: s.nome,
          tipo: s.tipo,
          permite_online: s.permite_online,
          mensagem_personalizada: s.mensagem_personalizada,
          dias_atendimento: s.dias_atendimento,
          periodos: s.periodos,
        })),
      };

      const { error: ruleError } = await supabase
        .from('business_rules')
        .insert([{
          cliente_id: clienteId,
          medico_id: medicoId,
          config: JSON.parse(JSON.stringify(businessRuleConfig)) as Json,
          ativo: true,
        }]);

      if (ruleError) {
        console.error('Erro ao criar business rules:', ruleError);
      }

      // 4. Create preparos if any
      for (const preparo of formData.preparos) {
        if (preparo.nome && preparo.exame) {
          const { error: preparoError } = await supabase
            .from('preparos')
            .insert({
              cliente_id: clienteId,
              nome: preparo.nome,
              exame: preparo.exame,
              jejum_horas: preparo.jejum_horas,
              restricoes_alimentares: preparo.restricoes_alimentares || null,
              medicacao_suspender: preparo.medicacao_suspender || null,
              dias_suspensao: preparo.dias_suspensao,
              itens_levar: preparo.itens_levar || null,
              valor_particular: preparo.valor_particular,
              valor_convenio: preparo.valor_convenio,
              forma_pagamento: preparo.forma_pagamento || null,
              observacoes_especiais: preparo.observacoes_especiais || null,
            });

          if (preparoError) {
            console.error('Erro ao criar preparo:', preparoError);
          }
        }
      }

      toast.success('Médico cadastrado com sucesso!');
      resetForm();
      onSuccess?.();
      return true;
    } catch (error) {
      console.error('Erro ao salvar médico:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar médico');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [clienteId, formData, currentStep, validateStep, resetForm, onSuccess]);

  return {
    formData,
    currentStep,
    totalSteps,
    isSubmitting,
    errors,
    updateField,
    addServico,
    updateServico,
    removeServico,
    addPreparo,
    updatePreparo,
    removePreparo,
    toggleConvenio,
    nextStep,
    prevStep,
    goToStep,
    resetForm,
    submitForm,
    validateStep,
  };
}
