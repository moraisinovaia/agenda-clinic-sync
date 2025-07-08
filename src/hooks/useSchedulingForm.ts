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

export function useSchedulingForm(initialData?: Partial<SchedulingFormData>) {
  const [formData, setFormData] = useState<SchedulingFormData>({
    ...initialFormData,
    ...initialData
  });
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setFormData(initialFormData);
  };

  const handleSubmit = async (
    e: React.FormEvent,
    onSubmit: (data: SchedulingFormData) => Promise<void>
  ) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onSubmit(formData);
      // Só resetar o formulário se não houve erro
      resetForm();
    } catch (error) {
      // Se houver erro, NÃO resetar o formulário - manter os dados preenchidos
      console.log('Erro capturado no useSchedulingForm - mantendo dados do formulário');
    } finally {
      setLoading(false);
    }
  };

  return {
    formData,
    setFormData,
    loading,
    resetForm,
    handleSubmit,
  };
}