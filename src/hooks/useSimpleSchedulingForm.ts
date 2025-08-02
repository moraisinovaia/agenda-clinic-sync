import { useState, useEffect } from 'react';
import { SchedulingFormData } from '@/types/scheduling';
import { useFormValidation } from './useFormValidation';

const initialFormData: SchedulingFormData = {
  nomeCompleto: '',
  dataNascimento: '',
  convenio: '',
  telefone: '',
  celular: '',
  medicoId: '',
  atendimentoId: '',
  dataAgendamento: '',
  horaAgendamento: '',
  observacoes: '',
};

interface UseSimpleSchedulingFormProps {
  initialData?: Partial<SchedulingFormData>;
  preSelectedDoctor?: string;
  preSelectedDate?: string;
}

export function useSimpleSchedulingForm(props?: UseSimpleSchedulingFormProps) {
  const [formData, setFormData] = useState<SchedulingFormData>(() => ({
    ...initialFormData,
    ...props?.initialData,
    ...(props?.preSelectedDoctor && { medicoId: props.preSelectedDoctor }),
    ...(props?.preSelectedDate && { dataAgendamento: props.preSelectedDate })
  }));
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { errors: validationErrors, validateForm, clearAllErrors } = useFormValidation();

  // ✅ CORREÇÃO: Remover validação automática que causava loops infinitos
  // Validação será feita apenas on-demand ao submeter

  const resetForm = () => {
    setFormData(initialFormData);
    setError(null);
    setLoading(false);
    clearAllErrors();
  };

  const handleSubmit = async (
    e: React.FormEvent,
    onSubmit: (data: SchedulingFormData) => Promise<void>
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🎯 SimpleSchedulingForm: Iniciando submissão', { formData });
    console.log('🔍 TRACE: handleSubmit - componente montado, loading:', loading);
    
    // Validar formulário antes de submeter
    const { isValid, errors } = validateForm(formData);
    
    if (!isValid) {
      console.log('❌ SimpleSchedulingForm: Validação falhou:', errors);
      setError('Por favor, corrija os erros no formulário antes de continuar.');
      return;
    }
    
    setLoading(true);
    setError(null);
    clearAllErrors();
    
    console.log('🔄 TRACE: handleSubmit - iniciando onSubmit, loading agora:', true);
    
    try {
      await onSubmit(formData);
      console.log('✅ TRACE: handleSubmit - onSubmit SUCCESS, resetando formulário');
      resetForm();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.log('❌ TRACE: handleSubmit - onSubmit ERROR:', errorMessage);
      console.log('🔍 TRACE: handleSubmit - preservando formData para evitar perda de dados');
      
      // Detectar especificamente erros de conflito
      const isConflictError = errorMessage.includes('conflito') || 
                            errorMessage.includes('ocupado') || 
                            errorMessage.includes('já existe um agendamento');
      
      if (isConflictError) {
        console.log('⚠️ CONFLICT DETECTED: Erro de conflito detectado, preservando formulário');
        setError(`Conflito de horário: ${errorMessage}`);
      } else {
        console.log('❌ OTHER ERROR: Erro geral, preservando formulário');
        setError(errorMessage);
      }
      
      // CRÍTICO: NÃO resetar formulário em NENHUM caso de erro
      // O usuário deve manter os dados para corrigir o problema
    } finally {
      console.log('🔄 TRACE: handleSubmit - finalizando, setando loading para false');
      setLoading(false);
      console.log('✅ TRACE: handleSubmit - loading finalizado');
    }
  };

  return {
    formData,
    setFormData,
    loading,
    error,
    validationErrors,
    resetForm,
    handleSubmit,
  };
}