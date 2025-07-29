
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

export function useSchedulingForm(initialData?: Partial<SchedulingFormData>) {
  const [formData, setFormData] = useState<SchedulingFormData>(() => ({
    ...initialFormData,
    ...initialData
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  // Garantir que os dados iniciais sejam aplicados apenas na primeira renderização
  useEffect(() => {
    if (initialData && !hasInitialized.current) {
      setFormData(prev => ({
        ...initialFormData,
        ...initialData
      }));
      hasInitialized.current = true;
    }
  }, [initialData]);

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
      setError(errorMessage);
      console.log('❌ Erro capturado - mantendo dados do formulário:', errorMessage);
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
