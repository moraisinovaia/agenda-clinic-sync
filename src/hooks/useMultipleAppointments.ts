import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MultipleAppointmentData, MultipleAppointmentResult } from '@/types/multiple-appointments';

export function useMultipleAppointments() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const createMultipleAppointments = useCallback(async (formData: MultipleAppointmentData): Promise<MultipleAppointmentResult> => {
    if (formData.atendimentoIds.length === 0) {
      throw new Error('Selecione pelo menos um exame');
    }

    setLoading(true);
    
    try {
      console.log('🔄 useMultipleAppointments: Iniciando criação múltipla');
      console.log('📋 FormData completo:', JSON.stringify(formData, null, 2));
      console.log('🔍 Dados enviados para criar_agendamento_multiplo:', {
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
        p_criado_por: 'Recepcionista',
        p_criado_por_user_id: null
      });

      console.log('📅 Data formatada corretamente:', formData.dataAgendamento);
      console.log('🕒 Horário formatado corretamente:', formData.horaAgendamento);

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
        p_criado_por: 'Recepcionista',
        p_criado_por_user_id: null
      });

      console.log('📥 Resposta da função criar_agendamento_multiplo:', { data, error });
      console.log('✅ Raw result:', JSON.stringify(data, null, 2));

      if (error) {
        console.error('❌ Erro na RPC:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        throw error;
      }

      const result = data as unknown as MultipleAppointmentResult;
      
      if (!result?.success) {
        console.error('❌ RPC retornou sucesso=false');
        console.error('❌ Error message:', result?.error);
        throw new Error(result?.error || 'Erro ao criar agendamentos múltiplos');
      }

      console.log('🎉 Agendamentos múltiplos criados com sucesso!');
      console.log('📊 IDs criados:', result.agendamento_ids);
      console.log('📊 Total criado:', result.total_agendamentos);

      toast({
        title: "Agendamentos criados!",
        description: result.message || `${result.total_agendamentos} agendamentos criados com sucesso`,
      });

      return result;
    } catch (error: any) {
      const errorMessage = error.message || 'Erro inesperado ao criar agendamentos';
      
      toast({
        title: "Erro ao agendar",
        description: errorMessage,
        variant: "destructive",
      });

      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    createMultipleAppointments,
    loading
  };
}