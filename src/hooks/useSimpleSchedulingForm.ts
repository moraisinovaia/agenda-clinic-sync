import { useState } from 'react';
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
    
    console.log('🎯 SimpleSchedulingForm: Iniciando submissão');
    
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
    
    try {
      await onSubmit(formData);
      console.log('✅ SimpleSchedulingForm: Sucesso - resetando formulário');
      resetForm();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.log('❌ SimpleSchedulingForm: Erro capturado:', errorMessage);
      setError(errorMessage);
      // NÃO resetar formulário em caso de erro
    } finally {
      setLoading(false);
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