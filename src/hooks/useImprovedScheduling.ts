import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SchedulingFormData } from '@/types/scheduling';

export function useImprovedScheduling() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Função para criar agendamento sem duplicação
  const createAppointment = async (formData: SchedulingFormData) => {
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    setLoading(true);
    try {
      console.log('🔄 Criando agendamento:', formData);

      const { data, error } = await supabase.rpc('criar_agendamento_atomico', {
        p_nome_completo: formData.nomeCompleto,
        p_data_nascimento: formData.dataNascimento,
        p_convenio: formData.convenio,
        p_telefone: formData.telefone || '',
        p_celular: formData.celular || '',
        p_medico_id: formData.medicoId,
        p_atendimento_id: formData.atendimentoId,
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

      const result = data as any;
      
      if (!result.success) {
        throw new Error(result.error || result.message);
      }

      toast({
        title: "Agendamento criado com sucesso!",
        description: result.message,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Erro ao criar agendamento:', error);
      
      // NÃO mostrar toast de erro aqui - deixar para o componente tratar
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Função para editar agendamento sem duplicação
  const updateAppointment = async (appointmentId: string, formData: SchedulingFormData) => {
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    setLoading(true);
    try {
      console.log('🔄 Editando agendamento:', appointmentId, formData);

      // Primeiro, buscar o paciente ou criar se não existir
      let pacienteId;
      
      const { data: existingPatient } = await supabase
        .from('pacientes')
        .select('id')
        .eq('nome_completo', formData.nomeCompleto)
        .eq('data_nascimento', formData.dataNascimento)
        .eq('convenio', formData.convenio)
        .single();

      if (existingPatient) {
        pacienteId = existingPatient.id;
      } else {
        const { data: newPatient, error: patientError } = await supabase
          .from('pacientes')
          .insert({
            nome_completo: formData.nomeCompleto,
            data_nascimento: formData.dataNascimento,
            convenio: formData.convenio,
            telefone: formData.telefone || '',
            celular: formData.celular || ''
          })
          .select('id')
          .single();

        if (patientError) {
          throw new Error(`Erro ao criar paciente: ${patientError.message}`);
        }
        
        pacienteId = newPatient.id;
      }

      // Atualizar o agendamento
      const { error: updateError } = await supabase
        .from('agendamentos')
        .update({
          paciente_id: pacienteId,
          medico_id: formData.medicoId,
          atendimento_id: formData.atendimentoId,
          data_agendamento: formData.dataAgendamento,
          hora_agendamento: formData.horaAgendamento,
          convenio: formData.convenio,
          observacoes: formData.observacoes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      if (updateError) {
        throw new Error(`Erro ao atualizar agendamento: ${updateError.message}`);
      }

      toast({
        title: "Agendamento atualizado com sucesso!",
        description: "As alterações foram salvas.",
      });

      return { success: true, message: 'Agendamento atualizado com sucesso' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Erro ao editar agendamento:', error);
      
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Função para verificar conflitos de horário
  const checkTimeConflict = useCallback(async (doctorId: string, date: string, time: string, excludeAppointmentId?: string) => {
    try {
      let query = supabase
        .from('agendamentos')
        .select('id, pacientes(nome_completo)')
        .eq('medico_id', doctorId)
        .eq('data_agendamento', date)
        .eq('hora_agendamento', time)
        .in('status', ['agendado', 'confirmado']);

      if (excludeAppointmentId) {
        query = query.neq('id', excludeAppointmentId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao verificar conflito:', error);
        return null;
      }

      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Erro ao verificar conflito:', error);
      return null;
    }
  }, []);

  return {
    loading,
    createAppointment,
    updateAppointment,
    checkTimeConflict
  };
}