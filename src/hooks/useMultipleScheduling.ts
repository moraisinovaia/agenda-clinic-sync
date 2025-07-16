import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MultipleSchedulingFormData, MultipleAppointmentResult, ExamCompatibility } from '@/types/multiple-scheduling';

export function useMultipleScheduling() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const createMultipleAppointment = async (formData: MultipleSchedulingFormData): Promise<MultipleAppointmentResult> => {
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('criar_agendamento_multiplo', {
        p_nome_completo: formData.nomeCompleto,
        p_data_nascimento: formData.dataNascimento,
        p_convenio: formData.convenio,
        p_telefone: formData.telefone || '',
        p_celular: formData.celular || '',
        p_medico_id: formData.medicoId,
        p_atendimento_ids: formData.atendimentoIds,
        p_data_agendamento: formData.dataAgendamento,
        p_hora_agendamento: formData.horaAgendamento,
        p_observacoes: formData.observacoes || null,
        p_criado_por: 'recepcionista',
        p_criado_por_user_id: user.id
      });

      if (error) {
        console.error('Erro no RPC:', error);
        throw new Error(error.message);
      }

      const result = data as unknown as MultipleAppointmentResult;
      
      if (!result.success) {
        throw new Error(result.error || result.message);
      }

      toast({
        title: "Agendamento múltiplo criado com sucesso!",
        description: result.message,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Erro ao criar agendamento múltiplo:', error);
      
      toast({
        title: "Erro ao agendar",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getCompatibleExams = async (doctorId?: string): Promise<ExamCompatibility[]> => {
    try {
      let query = supabase
        .from('vw_exames_combinaveis')
        .select('*')
        .eq('compativel', true);

      if (doctorId) {
        query = query.eq('medico_id', doctorId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar exames compatíveis:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar compatibilidade:', error);
      return [];
    }
  };

  return {
    loading,
    createMultipleAppointment,
    getCompatibleExams
  };
}