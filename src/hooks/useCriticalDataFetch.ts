import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppointmentWithRelations } from '@/types/scheduling';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook para operações críticas que NUNCA devem usar cache
 * Usado para validar dados após operações de escrita
 */
export function useCriticalDataFetch() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // 🔧 Busca CRÍTICA de agendamentos - SEMPRE do banco, NUNCA do cache
  const fetchAppointmentsCritical = useCallback(async (): Promise<AppointmentWithRelations[]> => {
    console.log('🚨 CRITICAL FETCH: Buscando agendamentos direto do banco (sem cache)');
    setLoading(true);
    
    try {
      // Usar timestamp para garantir que é uma query única
      const timestamp = Date.now();
      console.log('🚨 CRITICAL FETCH timestamp:', timestamp);
      
      const { data: appointmentsWithRelations, error } = await supabase
        .rpc('buscar_agendamentos_otimizado');

      if (error) {
        console.error('❌ CRITICAL FETCH erro:', error);
        throw error;
      }

      // Log detalhado para validação
      console.log('✅ CRITICAL FETCH sucesso:', {
        timestamp,
        totalAppointments: appointmentsWithRelations?.length || 0,
        sampleData: appointmentsWithRelations?.slice(0, 3).map(apt => ({
          id: apt.id,
          data: apt.data_agendamento,
          medico: apt.medico_nome,
          paciente: apt.paciente_nome
        }))
      });

      // Transformar dados no mesmo formato usado pelos outros hooks
      const transformedAppointments = (appointmentsWithRelations || []).map(apt => ({
        id: apt.id,
        paciente_id: apt.paciente_id,
        medico_id: apt.medico_id,
        atendimento_id: apt.atendimento_id,
        data_agendamento: apt.data_agendamento,
        hora_agendamento: apt.hora_agendamento,
        status: apt.status,
        observacoes: apt.observacoes,
        created_at: apt.created_at,
        updated_at: apt.updated_at,
        criado_por: apt.criado_por,
        criado_por_user_id: apt.criado_por_user_id,
        cancelado_em: null,
        cancelado_por: null,
        cancelado_por_user_id: null,
        confirmado_em: null,
        confirmado_por: null,
        confirmado_por_user_id: null,
        convenio: apt.paciente_convenio,
        pacientes: {
          id: apt.paciente_id,
          nome_completo: apt.paciente_nome,
          convenio: apt.paciente_convenio,
          celular: apt.paciente_celular,
          telefone: apt.paciente_telefone || '',
          data_nascimento: apt.paciente_data_nascimento || '',
          created_at: '',
          updated_at: ''
        },
        medicos: {
          id: apt.medico_id,
          nome: apt.medico_nome,
          especialidade: apt.medico_especialidade,
          ativo: true,
          crm: '',
          created_at: '',
          updated_at: '',
          convenios_aceitos: [],
          convenios_restricoes: null,
          horarios: null,
          idade_maxima: null,
          idade_minima: null,
          observacoes: ''
        },
        atendimentos: {
          id: apt.atendimento_id,
          nome: apt.atendimento_nome,
          tipo: apt.atendimento_tipo,
          ativo: true,
          medico_id: apt.medico_id,
          medico_nome: apt.medico_nome,
          created_at: '',
          updated_at: '',
          codigo: '',
          coparticipacao_unimed_20: 0,
          coparticipacao_unimed_40: 0,
          forma_pagamento: 'convenio',
          horarios: null,
          observacoes: '',
          valor_convenio: 0,
          valor_particular: 0,
          restricoes: null
        }
      }));

      return transformedAppointments;
    } catch (error) {
      console.error('❌ CRITICAL FETCH falhou:', error);
      toast({
        title: 'Erro crítico',
        description: 'Falha ao buscar dados atualizados do banco',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // 🔧 Validar consistência: comparar dados do cache vs banco
  const validateDataConsistency = useCallback(async (cachedData: AppointmentWithRelations[]) => {
    console.log('🔍 VALIDANDO consistência entre cache e banco...');
    
    try {
      const freshData = await fetchAppointmentsCritical();
      
      const comparison = {
        cachedCount: cachedData.length,
        freshCount: freshData.length,
        difference: Math.abs(cachedData.length - freshData.length),
        isConsistent: cachedData.length === freshData.length
      };
      
      console.log('🔍 RESULTADO da validação:', comparison);
      
      if (!comparison.isConsistent) {
        console.warn('⚠️ INCONSISTÊNCIA DETECTADA entre cache e banco!', comparison);
        toast({
          title: 'Dados desatualizados detectados',
          description: `Cache: ${comparison.cachedCount} agendamentos, Banco: ${comparison.freshCount} agendamentos`,
          variant: 'destructive',
        });
      }
      
      return comparison;
    } catch (error) {
      console.error('❌ Erro na validação de consistência:', error);
      return null;
    }
  }, [fetchAppointmentsCritical, toast]);

  return {
    fetchAppointmentsCritical,
    validateDataConsistency,
    loading
  };
}