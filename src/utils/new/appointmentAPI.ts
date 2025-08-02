import { supabase } from '@/integrations/supabase/client';
import { AppointmentFormData } from '@/hooks/new/useFormState';

export interface AppointmentResult {
  success: boolean;
  error?: string;
  data?: any;
  warnings?: string[];
}

export async function createAppointment(formData: AppointmentFormData, userId?: string): Promise<AppointmentResult> {
  try {
    console.log('🔄 Criando agendamento:', {
      paciente: formData.nomeCompleto,
      medico: formData.medicoId,
      data: formData.dataAgendamento,
      hora: formData.horaAgendamento
    });

    const { data, error } = await supabase.rpc('criar_agendamento_atomico', {
      p_nome_completo: formData.nomeCompleto,
      p_data_nascimento: formData.dataNascimento,
      p_convenio: formData.convenio,
      p_telefone: formData.telefone || null,
      p_celular: formData.celular || null,
      p_medico_id: formData.medicoId,
      p_atendimento_id: formData.atendimentoId,
      p_data_agendamento: formData.dataAgendamento,
      p_hora_agendamento: formData.horaAgendamento,
      p_observacoes: formData.observacoes || null,
      p_criado_por: 'Sistema Novo',
      p_criado_por_user_id: userId || null
    });

    if (error) {
      console.warn('❌ Erro RPC:', error);
      return {
        success: false,
        error: error.message || 'Erro ao criar agendamento'
      };
    }

    if (!data || typeof data !== 'object') {
      console.warn('❌ Resposta inválida:', data);
      return {
        success: false,
        error: 'Resposta inválida do servidor'
      };
    }

    // Parse do resultado JSON
    const result = typeof data === 'string' ? JSON.parse(data) : data;
    
    if (result.success) {
      console.log('✅ Agendamento criado:', result);
      return {
        success: true,
        data: result,
        warnings: result.warnings
      };
    } else {
      console.warn('❌ Falha na criação:', result.error);
      return {
        success: false,
        error: result.error || 'Erro desconhecido'
      };
    }
  } catch (err) {
    console.error('❌ Erro crítico:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro interno do sistema'
    };
  }
}

export async function checkTimeConflict(
  medicoId: string, 
  dataAgendamento: string, 
  horaAgendamento: string
): Promise<AppointmentResult> {
  try {
    const { data, error } = await supabase.rpc('validar_conflito_agendamento', {
      p_medico_id: medicoId,
      p_data_agendamento: dataAgendamento,
      p_hora_agendamento: horaAgendamento
    });

    if (error) {
      console.warn('Erro ao verificar conflito:', error);
      return {
        success: false,
        error: 'Erro ao verificar disponibilidade'
      };
    }

    const result = typeof data === 'string' ? JSON.parse(data) : data;
    
    if (result.has_conflict) {
      return {
        success: false,
        error: result.message || 'Horário não disponível',
        data: result
      };
    }

    return {
      success: true,
      data: result
    };
  } catch (err) {
    console.error('Erro ao verificar conflito:', err);
    return {
      success: false,
      error: 'Erro ao verificar disponibilidade'
    };
  }
}