import { useState, useCallback } from 'react';
import { createAppointment, checkTimeConflict, AppointmentResult } from '@/utils/new/appointmentAPI';
import { AppointmentFormData } from '@/hooks/new/useFormState';
import { validateAppointmentForm } from '@/utils/new/appointmentValidation';
import { toast } from 'sonner';

export function useSimpleAppointmentCreation() {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<AppointmentResult | null>(null);

  const submitAppointment = useCallback(async (
    formData: AppointmentFormData,
    userId?: string
  ): Promise<AppointmentResult> => {
    try {
      setLoading(true);
      setLastResult(null);

      console.log('🚀 Iniciando criação de agendamento...');

      // Validação local primeiro
      const validation = validateAppointmentForm(formData);
      if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0];
        const result: AppointmentResult = {
          success: false,
          error: firstError
        };
        setLastResult(result);
        return result;
      }

      // Verificar conflitos antes de criar
      console.log('🔍 Verificando conflitos...');
      const conflictCheck = await checkTimeConflict(
        formData.medicoId,
        formData.dataAgendamento,
        formData.horaAgendamento
      );

      if (!conflictCheck.success) {
        console.log('⚠️ Conflito detectado:', conflictCheck.error);
        const result: AppointmentResult = {
          success: false,
          error: conflictCheck.error,
          data: conflictCheck.data
        };
        setLastResult(result);
        return result;
      }

      // Criar agendamento
      console.log('✨ Criando agendamento...');
      const createResult = await createAppointment(formData, userId);
      
      setLastResult(createResult);

      if (createResult.success) {
        toast.success('Agendamento criado com sucesso!');
        
        if (createResult.warnings && createResult.warnings.length > 0) {
          createResult.warnings.forEach(warning => {
            toast.warning(warning);
          });
        }
      } else {
        // NÃO usar toast.error aqui - deixar o componente mostrar o erro
        console.warn('❌ Falha na criação:', createResult.error);
      }

      return createResult;
      
    } catch (err) {
      console.error('❌ Erro crítico no hook:', err);
      const result: AppointmentResult = {
        success: false,
        error: err instanceof Error ? err.message : 'Erro interno'
      };
      setLastResult(result);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearLastResult = useCallback(() => {
    setLastResult(null);
  }, []);

  return {
    loading,
    lastResult,
    submitAppointment,
    clearLastResult
  };
}