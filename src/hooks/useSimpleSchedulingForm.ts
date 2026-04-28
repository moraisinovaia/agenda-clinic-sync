import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { SchedulingFormData } from '@/types/scheduling';
import { isValidPhone } from '@/utils/phoneFormatter';

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
  const { toast } = useToast();
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

    if (!formData.celular || !isValidPhone(formData.celular)) {
      toast({
        variant: 'destructive',
        title: 'Celular obrigatório',
        description: 'Informe o celular do paciente com DDD (ex: (87) 99999-9999 ou (87) 9999-9999).',
      });
      setLoading(false);
      return;
    }

    try {
      await onSubmit(formData);
      console.log('✅ SimpleSchedulingForm: Sucesso - resetando formulário');
      resetForm();
    } catch (error: any) {
      console.log('❌ SimpleSchedulingForm: Erro capturado:', error);
      
      // CRÍTICO: Não resetar formulário em caso de erro - preservar dados
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.log('❌ SimpleSchedulingForm: Erro capturado, preservando dados:', errorMessage);
      
      // Se é erro de conflito, notificar e NÃO propagar
      if (error?.isConflict || error?.conflict_detected) {
        console.log('⚠️ Conflito detectado - notificando e preservando dados');
        toast({
          title: 'Horário já ocupado',
          description: errorMessage || 'Já existe um paciente agendado neste horário. Ajuste a data ou horário e tente novamente.',
          variant: 'destructive',
        });
        // Não propagar e não resetar; manter dados para edição
      } else {
        // Para outros erros, mostrar no formulário SEM RESETAR
        setError(errorMessage);
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