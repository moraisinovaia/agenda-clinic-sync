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
      resetForm();
    } catch (error) {
      // Não fazer log genérico aqui, deixar o useSupabaseScheduling lidar com o erro
      // O erro específico já foi mostrado no toast pelo useSupabaseScheduling
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