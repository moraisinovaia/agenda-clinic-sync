import { useState } from 'react';
import { SchedulingFormData } from '@/types/scheduling';

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

  const resetForm = () => {
    setFormData(initialFormData);
    setError(null);
    setLoading(false);
  };

  const handleSubmit = async (
    e: React.FormEvent,
    onSubmit: (data: SchedulingFormData) => Promise<{ success: boolean; error?: string }>
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🎯 SimpleSchedulingForm: Iniciando submissão - sem throw errors');
    
    setLoading(true);
    setError(null);
    
    try {
      // ✅ onSubmit agora retorna objeto ao invés de throw
      const result = await onSubmit(formData);
      
      if (result.success) {
        console.log('✅ SimpleSchedulingForm: Sucesso - resetando formulário');
        resetForm();
      } else {
        console.log('❌ SimpleSchedulingForm: Erro no resultado:', result.error);
        setError(result.error || 'Erro desconhecido');
        // ✅ NÃO resetar formulário em caso de erro - preservar dados
      }
    } catch (error) {
      // ✅ Catch apenas para erros inesperados do sistema
      const errorMessage = error instanceof Error ? error.message : 'Erro inesperado do sistema';
      console.log('❌ SimpleSchedulingForm: Erro inesperado capturado:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return {
    formData,
    setFormData,
    loading,
    error,
    resetForm,
    handleSubmit,
  };
}