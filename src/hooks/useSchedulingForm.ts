
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
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      await onSubmit(formData);
      // Só resetar o formulário se não houve erro
      console.log('✅ Agendamento criado com sucesso, resetando formulário...');
      resetForm();
    } catch (error) {
      // Capturar e definir o erro para exibição
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      // Se for erro de conflito de horário, manter dados do formulário
      if (errorMessage.includes('já está ocupado')) {
        setError(errorMessage);
        console.log('❌ Conflito de horário detectado - mantendo dados do formulário:', errorMessage);
      } else {
        // Para outros erros, também manter dados para permitir correção
        setError(errorMessage);
        console.log('❌ Erro capturado - mantendo dados do formulário:', errorMessage);
      }
    } finally {
      console.log('🏁 Finalizando loading state...');
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
