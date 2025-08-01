
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
    // CRITICAL: Prevenir comportamento padrão do form que pode causar reload
    e.preventDefault();
    e.stopPropagation();
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('🎯 useSchedulingForm: Iniciando handleSubmit');
      await onSubmit(formData);
      console.log('✅ useSchedulingForm: Agendamento criado com sucesso, resetando formulário...');
      resetForm();
    } catch (error) {
      // CRITICAL: Capturar QUALQUER erro para evitar propagação não controlada
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      console.log('❌ useSchedulingForm: Erro capturado:', errorMessage);
      setError(errorMessage);
      
      // CRITICAL: Prevenir qualquer possível reload da página
      if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', (e) => {
          e.preventDefault();
          e.returnValue = '';
        }, { once: true });
      }
    } finally {
      console.log('🏁 useSchedulingForm: Finalizando loading state...');
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
