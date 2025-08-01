
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
    // CRITICAL: Prevenir múltiplas execuções simultâneas
    if (isSubmitting.current) {
      console.log('⏸️ useSchedulingForm: Já existe uma submissão em andamento, ignorando...');
      return;
    }

    // CRITICAL: Prevenir comportamento padrão do form que pode causar reload
    e.preventDefault();
    e.stopPropagation();
    
    // CRITICAL: Marcar como em submissão e resetar flags de erro
    isSubmitting.current = true;
    hasError.current = false;
    setLoading(true);
    setError(null);
    
    console.log('🎯 useSchedulingForm: Iniciando handleSubmit com dados:', formData);
    console.log('🔐 useSchedulingForm: Mutex ativado - submissão protegida');
    
    try {
      // CRITICAL: Aguardar o resultado do onSubmit
      await onSubmit(formData);
      
      // CRITICAL: Só resetar se não houve erro E ainda estamos na mesma submissão
      if (!hasError.current && isSubmitting.current) {
        console.log('✅ useSchedulingForm: Agendamento criado com sucesso, resetando formulário...');
        resetForm();
      } else {
        console.log('🚫 useSchedulingForm: Reset cancelado devido a erro ou concorrência');
      }
    } catch (error) {
      // CRITICAL: Marcar flag de erro para prevenir reset
      hasError.current = true;
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao criar agendamento';
      
      console.log('❌ useSchedulingForm: Erro capturado:', errorMessage);
      console.log('🔒 useSchedulingForm: Flag de erro ativada - formulário preservado');
      
      // CRITICAL: Garantir que o erro seja sempre exibido
      setError(errorMessage);
      
      // CRITICAL: Force re-render para garantir que o erro apareça
      setTimeout(() => {
        if (hasError.current) {
          console.log('🔄 useSchedulingForm: Forçando atualização de erro para exibição');
          setError(errorMessage);
        }
      }, 100);
      
      // CRITICAL: NÃO resetar o formulário em caso de erro - manter dados para correção
      // CRITICAL: NÃO re-throw o erro para evitar que chegue ao ErrorBoundary
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
