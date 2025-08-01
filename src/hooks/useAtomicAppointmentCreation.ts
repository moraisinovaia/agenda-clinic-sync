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

  // Validações básicas no frontend
  const validateFormData = (formData: SchedulingFormData) => {
    if (!formData.medicoId?.trim()) {
      throw new Error('Médico é obrigatório');
    }
    if (!formData.atendimentoId?.trim()) {
      throw new Error('Tipo de atendimento é obrigatório');
    }
    if (!formData.nomeCompleto?.trim()) {
      throw new Error('Nome completo é obrigatório');
    }
    if (formData.nomeCompleto.trim().length < 3) {
      throw new Error('Nome completo deve ter pelo menos 3 caracteres');
    }
    if (!formData.dataNascimento) {
      throw new Error('Data de nascimento é obrigatória');
    }
    if (!formData.convenio?.trim()) {
      throw new Error('Convênio é obrigatório');
    }
    if (!formData.celular?.trim()) {
      throw new Error('Celular é obrigatório');
    }
    
    // Validação de formato de celular brasileiro
    const celularRegex = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;
    if (!celularRegex.test(formData.celular)) {
      throw new Error('Formato de celular inválido. Use o formato (XX) XXXXX-XXXX');
    }
    
    if (!formData.dataAgendamento) {
      throw new Error('Data do agendamento é obrigatória');
    }
    if (!formData.horaAgendamento) {
      throw new Error('Hora do agendamento é obrigatória');
    }
    
    // Validar se o usuário está autenticado
    if (!user?.id) {
      throw new Error('Usuário não está autenticado');
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
      throw new Error(`Agendamento deve ser feito com pelo menos 1 hora de antecedência. Horário atual do Brasil: ${currentTimeFormatted} - Agendamento solicitado: ${requestedTimeFormatted}`);
    }

    // Validar idade do paciente
    const birthDate = new Date(formData.dataNascimento);
    const age = Math.floor((nowBrazil.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    
    if (age < 0 || age > 120) {
      throw new Error('Data de nascimento inválida');
    }
  };

  // ✅ ESTABILIZAR: Criar agendamento com função atômica e retry automático
  const createAppointment = useCallback(async (formData: SchedulingFormData, editingAppointmentId?: string): Promise<any> => {
    let lastError: Error | null = null;

    try {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          setLoading(true);
          console.log(`🚀 Tentativa ${attempt}/${MAX_RETRIES} - Criando agendamento:`, formData);

          // Validações no frontend
          validateFormData(formData);

          // Buscar nome do usuário logado
          const { data: profile } = await supabase
            .from('profiles')
            .select('nome')
            .eq('user_id', user?.id)
            .single();

          // Chamar função SQL atômica

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
            console.error(`❌ Erro na tentativa ${attempt}:`, error);
            throw error;
          }

          console.log(`✅ Resultado da tentativa ${attempt}:`, data);

          // Verificar se a função retornou sucesso
          const result = data as unknown as AtomicAppointmentResult;
          if (!result?.success) {
            const errorMessage = result?.error || result?.message || 'Erro desconhecido na criação do agendamento';
            throw new Error(errorMessage);
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

          console.log(`✅ Agendamento criado com sucesso na tentativa ${attempt}:`, data);
          return data;

        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Erro desconhecido');
          console.error(`❌ Erro na tentativa ${attempt}:`, lastError);

          // Se é erro de conflito de horário, não mostrar toast nem fazer retry
          if (lastError.message.includes('já está ocupado')) {
            console.log('❌ Erro de conflito de horário detectado - não fazer retry');
            // Não mostrar toast aqui, deixar o componente tratar
            throw new Error(lastError.message);
          }

          // Se é um erro de validação ou outros tipos, não fazer retry
          if (attempt === MAX_RETRIES || 
              lastError.message.includes('obrigatório') ||
              lastError.message.includes('inválido') ||
              lastError.message.includes('não está ativo') ||
              lastError.message.includes('bloqueada') ||
              lastError.message.includes('idade') ||
              lastError.message.includes('convênio')) {
            break;
          }

          // Aguardar antes do próximo retry (backoff exponencial)
          const delayTime = RETRY_DELAY * Math.pow(2, attempt - 1);
          console.log(`⏳ Aguardando ${delayTime}ms antes da próxima tentativa...`);
          await delay(delayTime);
        }
      }

      // Se chegou aqui, todas as tentativas falharam
      const errorMessage = lastError?.message || 'Não foi possível criar o agendamento';
      
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
      
      console.error(`❌ Falha após ${MAX_RETRIES} tentativas:`, lastError);
      throw lastError;
      
    } finally {
      // Garantir que o loading sempre seja resetado
      console.log('🏁 Resetando loading state...');
      setLoading(false);
    }
  }, [user?.id]); // ✅ ESTABILIZAR: Apenas user?.id como dependência

  return {
    loading,
    createAppointment,
  };
}