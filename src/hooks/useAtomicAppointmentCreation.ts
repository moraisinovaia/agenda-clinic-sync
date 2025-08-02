import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SchedulingFormData } from '@/types/scheduling';
import { AtomicAppointmentResult } from '@/types/atomic-scheduling';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { BRAZIL_TIMEZONE } from '@/utils/timezone';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 segundo

export function useAtomicAppointmentCreation() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Função de delay para retry
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // ✅ CORREÇÃO: Validações retornam objeto resultado ao invés de throw
  const validateFormData = (formData: SchedulingFormData): { success: boolean; error?: string } => {
    if (!formData.medicoId?.trim()) {
      return { success: false, error: 'Médico é obrigatório' };
    }
    if (!formData.atendimentoId?.trim()) {
      return { success: false, error: 'Tipo de atendimento é obrigatório' };
    }
    if (!formData.nomeCompleto?.trim()) {
      return { success: false, error: 'Nome completo é obrigatório' };
    }
    if (formData.nomeCompleto.trim().length < 3) {
      return { success: false, error: 'Nome completo deve ter pelo menos 3 caracteres' };
    }
    if (!formData.dataNascimento) {
      return { success: false, error: 'Data de nascimento é obrigatória' };
    }
    if (!formData.convenio?.trim()) {
      return { success: false, error: 'Convênio é obrigatório' };
    }
    if (!formData.celular?.trim()) {
      return { success: false, error: 'Celular é obrigatório' };
    }
    
    // Validação de formato de celular brasileiro
    const celularRegex = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;
    if (!celularRegex.test(formData.celular)) {
      return { success: false, error: 'Formato de celular inválido. Use o formato (XX) XXXXX-XXXX' };
    }
    
    if (!formData.dataAgendamento) {
      return { success: false, error: 'Data do agendamento é obrigatória' };
    }
    if (!formData.horaAgendamento) {
      return { success: false, error: 'Hora do agendamento é obrigatória' };
    }
    
    // Validar se o usuário está autenticado
    if (!user?.id) {
      return { success: false, error: 'Usuário não está autenticado' };
    }

    // Validações de negócio - usar timezone do Brasil
    const appointmentDateTime = new Date(`${formData.dataAgendamento}T${formData.horaAgendamento}`);
    
    // Obter horário atual no Brasil
    const nowBrazil = toZonedTime(new Date(), BRAZIL_TIMEZONE);
    const oneHourFromNowBrazil = new Date(nowBrazil.getTime() + 60 * 60 * 1000);
    
    // Converter horário do agendamento para o timezone do Brasil
    const appointmentDateTimeBrazil = toZonedTime(appointmentDateTime, BRAZIL_TIMEZONE);
    
    if (appointmentDateTimeBrazil <= oneHourFromNowBrazil) {
      const currentTimeFormatted = formatInTimeZone(nowBrazil, BRAZIL_TIMEZONE, 'dd/MM/yyyy HH:mm');
      const requestedTimeFormatted = formatInTimeZone(appointmentDateTimeBrazil, BRAZIL_TIMEZONE, 'dd/MM/yyyy HH:mm');
      return { success: false, error: `Agendamento deve ser feito com pelo menos 1 hora de antecedência. Horário atual do Brasil: ${currentTimeFormatted} - Agendamento solicitado: ${requestedTimeFormatted}` };
    }

    // Validar idade do paciente
    const birthDate = new Date(formData.dataNascimento);
    const age = Math.floor((nowBrazil.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    
    if (age < 0 || age > 120) {
      return { success: false, error: 'Data de nascimento inválida' };
    }
    
    return { success: true };
  };

  // ✅ CORREÇÃO DEFINITIVA: Não usar throw para validações
  const createAppointment = useCallback(async (formData: SchedulingFormData, editingAppointmentId?: string): Promise<{ success: boolean; error?: string; data?: any }> => {
    try {
      setLoading(true);
      console.log('🎯 useAtomicAppointmentCreation: Criando agendamento - NÃO usar throw para validações');

      // ✅ Validações retornam objeto ao invés de throw
      const validation = validateFormData(formData);
      if (!validation.success) {
        console.log('❌ Erro de validação:', validation.error);
        return { success: false, error: validation.error };
      }

      // Buscar nome do usuário logado
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('user_id', user?.id)
        .single();

      // Chamar função SQL atômica COM LOCKS (uma única tentativa)
      const { data, error } = await supabase.rpc('criar_agendamento_atomico', {
        p_nome_completo: formData.nomeCompleto,
        p_data_nascimento: formData.dataNascimento,
        p_convenio: formData.convenio,
        p_telefone: formData.telefone || null,
        p_celular: formData.celular,
        p_medico_id: formData.medicoId,
        p_atendimento_id: formData.atendimentoId,
        p_data_agendamento: formData.dataAgendamento,
        p_hora_agendamento: formData.horaAgendamento,
        p_observacoes: formData.observacoes || null,
        p_criado_por: profile?.nome || 'Recepcionista',
        p_criado_por_user_id: user?.id,
        p_agendamento_id_edicao: editingAppointmentId || null,
        p_force_update_patient: !!editingAppointmentId,
      });

      if (error) {
        console.error('❌ Erro na chamada da função:', error);
        throw error;
      }

      console.log('✅ Resultado da função:', data);

      // ✅ Verificar resultado SEM usar throw para conflitos
      const result = data as unknown as AtomicAppointmentResult;
      if (!result?.success) {
        const errorMessage = result?.error || result?.message || 'Erro desconhecido na criação do agendamento';
        console.log('❌ Função SQL retornou erro:', errorMessage);
        
        // ✅ Retornar objeto de erro ao invés de throw
        return { success: false, error: errorMessage };
      }

      // Sucesso!
      const isEditing = !!editingAppointmentId;
      
      // Verificar se há warnings
      if (result.warnings && result.warnings.length > 0) {
        // Mostrar toast com warnings
        toast({
          title: 'Agendamento criado com atenções!',
          description: `${isEditing ? 'Agendamento atualizado' : 'Agendamento criado'} para ${formData.dataAgendamento} às ${formData.horaAgendamento}. ${result.warnings.join('. ')}`,
          variant: 'default',
        });
      } else {
        // Toast normal de sucesso
        toast({
          title: 'Sucesso!',
          description: isEditing ? 
            `Agendamento atualizado para ${formData.dataAgendamento} às ${formData.horaAgendamento}` :
            `Agendamento criado para ${formData.dataAgendamento} às ${formData.horaAgendamento}`,
        });
      }

      console.log('✅ Agendamento criado com sucesso:', data);
      return { success: true, data };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('❌ Erro na criação do agendamento:', errorMessage);

      // ✅ Para erros críticos do sistema (não de validação), mostrar toast
      const isSystemError = !errorMessage.includes('já está ocupado') &&
          !errorMessage.includes('bloqueada') &&
          !errorMessage.includes('idade') &&
          !errorMessage.includes('convênio') &&
          !errorMessage.includes('obrigatório') &&
          !errorMessage.includes('inválido') &&
          !errorMessage.includes('não está ativo');

      if (isSystemError) {
        toast({
          title: 'Erro no Sistema',
          description: errorMessage,
          variant: 'destructive',
        });
      }
      
      // ✅ Retornar objeto de erro ao invés de throw
      return { success: false, error: errorMessage };
      
    } finally {
      // Garantir que o loading sempre seja resetado
      console.log('🏁 Resetando loading state...');
      setLoading(false);
    }
  }, [user?.id, toast]); // ✅ DEFINITIVO: Dependências estáveis

  return {
    loading,
    createAppointment,
  };
}