import { useState } from 'react';
import { createAppointment, checkTimeConflict, AppointmentResult } from '@/utils/new/appointmentAPI';
import { AppointmentFormData } from './useFormState';
import { toast } from 'sonner';

/**
 * HOOK ISOLADO PARA CRIAÇÃO DE AGENDAMENTOS
 * 
 * ✅ ZERO dependências de hooks antigos
 * ✅ ZERO error boundaries
 * ✅ ZERO throws - apenas retorna objetos
 * ✅ Error handling visual próprio
 * ✅ Loading states independentes
 */
export function useIsolatedAppointmentCreation() {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<AppointmentResult | null>(null);

  const submitAppointment = async (
    formData: AppointmentFormData, 
    userId?: string
  ): Promise<AppointmentResult> => {
    console.log('🆕 useIsolatedAppointmentCreation: Iniciando submissão isolada');
    
    try {
      setLoading(true);
      setLastResult(null);

      // ✅ Verificar conflito primeiro - sem throws
      console.log('🔍 Verificando conflito de horário...');
      const conflictCheck = await checkTimeConflict(
        formData.medicoId,
        formData.dataAgendamento,
        formData.horaAgendamento
      );

      if (!conflictCheck.success) {
        console.log('❌ Conflito detectado:', conflictCheck.error);
        const result: AppointmentResult = {
          success: false,
          error: conflictCheck.error || 'Horário não disponível'
        };
        setLastResult(result);
        
        // ✅ Toast visual - sem throw
        toast.error(result.error, {
          description: 'Tente outro horário ou médico'
        });
        
        return result;
      }

      // ✅ Criar agendamento - sem throws
      console.log('✅ Sem conflitos, criando agendamento...');
      const createResult = await createAppointment(formData, userId);

      setLastResult(createResult);

      if (createResult.success) {
        console.log('✅ Agendamento criado com sucesso:', createResult.data);
        
        // ✅ Toast de sucesso
        toast.success('Agendamento criado com sucesso!', {
          description: `Paciente: ${formData.nomeCompleto}`
        });

        // ✅ Warnings se houver
        if (createResult.warnings?.length) {
          createResult.warnings.forEach(warning => {
            toast.warning(warning);
          });
        }
      } else {
        console.log('❌ Falha na criação:', createResult.error);
        
        // ✅ Toast de erro - sem throw
        toast.error(createResult.error || 'Erro ao criar agendamento', {
          description: 'Verifique os dados e tente novamente'
        });
      }

      return createResult;

    } catch (err) {
      console.error('❌ Erro crítico no sistema isolado:', err);
      
      const result: AppointmentResult = {
        success: false,
        error: err instanceof Error ? err.message : 'Erro interno do sistema'
      };
      
      setLastResult(result);
      
      // ✅ Toast de erro crítico - sem throw
      toast.error('Erro interno do sistema', {
        description: 'Entre em contato com o suporte técnico'
      });
      
      return result;
    } finally {
      setLoading(false);
    }
  };

  const clearLastResult = () => {
    setLastResult(null);
  };

  return {
    submitAppointment,
    loading,
    lastResult,
    clearLastResult
  };
}