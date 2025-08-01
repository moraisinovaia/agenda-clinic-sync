
import { useState, useEffect, useRef } from 'react';
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

interface UseSchedulingFormProps {
  initialData?: Partial<SchedulingFormData>;
  preSelectedDoctor?: string;
  preSelectedDate?: string;
}

export function useSchedulingForm(props?: UseSchedulingFormProps) {
  const [formData, setFormData] = useState<SchedulingFormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasInitialized = useRef(false);
  const isSubmitting = useRef(false);
  const hasError = useRef(false);

  // Aplicar dados iniciais e pré-seleções apenas na primeira renderização
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      setFormData(prev => ({
        ...initialFormData,
        ...props?.initialData,
        ...(props?.preSelectedDoctor && { medicoId: props.preSelectedDoctor }),
        ...(props?.preSelectedDate && { dataAgendamento: props.preSelectedDate })
      }));
    }
  }, [props?.initialData, props?.preSelectedDoctor, props?.preSelectedDate]);

  const resetForm = () => {
    setFormData(initialFormData);
    setError(null);
    setLoading(false);
  };

  const handleSubmit = async (
    e: React.FormEvent,
    onSubmit: (data: SchedulingFormData) => Promise<void>
  ) => {
    // Prevenir múltiplas execuções simultâneas
    if (isSubmitting.current) {
      console.log('⏸️ useSchedulingForm: Já existe uma submissão em andamento, ignorando...');
      return;
    }

    // Prevenir comportamento padrão do form
    e.preventDefault();
    e.stopPropagation();
    
    // Marcar como em submissão
    isSubmitting.current = true;
    setLoading(true);
    setError(null);
    
    console.log('🎯 useSchedulingForm: Iniciando handleSubmit com dados:', formData);
    
    try {
      await onSubmit(formData);
      
      // Sucesso - resetar formulário
      console.log('✅ useSchedulingForm: Agendamento criado com sucesso, resetando formulário...');
      resetForm();
      
    } catch (error) {
      // CRITICAL: Marcar erro IMEDIATAMENTE para prevenir reset
      hasError.current = true;
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao criar agendamento';
      
      console.log('❌ useSchedulingForm: Erro capturado:', errorMessage);
      console.log('🔒 useSchedulingForm: Formulário preservado devido ao erro');
      
      // Exibir erro sem resetar formulário
      setError(errorMessage);
      
      // NÃO re-throw o erro para manter o formulário preenchido
      return Promise.reject(error);
      
    } finally {
      console.log('🏁 useSchedulingForm: Finalizando submissão...');
      isSubmitting.current = false;
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
