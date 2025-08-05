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
    onSubmit: (data: SchedulingFormData) => Promise<void>
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🎯 SimpleSchedulingForm: Iniciando submissão');
    
    setLoading(true);
    setError(null);
    
    try {
      await onSubmit(formData);
      console.log('✅ SimpleSchedulingForm: Sucesso - resetando formulário');
      resetForm();
    } catch (error: any) {
      console.log('❌ SimpleSchedulingForm: Erro capturado:', error);
      
      // Se é erro de conflito, não mostrar no formulário
      if (error?.isConflict) {
        console.log('⚠️ Conflito detectado - propagando para componente');
        // Re-propagar erro de conflito para que o componente possa mostrar modal
        throw error;
      } else {
        // Para outros erros, mostrar no formulário
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        setError(errorMessage);
        // NÃO resetar formulário em caso de erro
      }
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