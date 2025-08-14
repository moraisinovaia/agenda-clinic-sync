import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppointmentWithRelations } from '@/types/scheduling';
interface DataValidationResult {
  isValid: boolean;
  frontendCount: number;
  databaseCount: number;
  discrepancy: number;
  needsRefetch: boolean;
}

/**
 * Hook para validação de integridade de dados
 * Compara dados do frontend vs banco e detecta inconsistências
 */
export function useDataValidation() {

  const validateAppointmentsData = useCallback(async (
    frontendAppointments: AppointmentWithRelations[],
    onInconsistency?: (result: DataValidationResult) => void
  ): Promise<DataValidationResult> => {
    try {
      // ✅ CORRIGIDO: Comparar dados equivalentes
      const frontendTotal = frontendAppointments.length;
      
      // ✅ CORRIGIDO: Buscar total real no banco (RPC retorna 1422)
      const { data: dbData, error } = await supabase
        .rpc('buscar_agendamentos_otimizado');

      if (error) {
        console.error('❌ [VALIDAÇÃO] Erro ao buscar dados do banco:', error);
        throw error;
      }

      const databaseTotal = dbData?.length || 0;

      // ✅ CRITÉRIO AJUSTADO: Só alertar se diferença for > 100 registros (evitar falsos positivos)
      const discrepancy = Math.abs(frontendTotal - databaseTotal);
      const discrepancyPercentage = databaseTotal > 0 ? (discrepancy / databaseTotal) * 100 : 0;
      const needsRefetch = discrepancy > 100 || discrepancyPercentage > 10;

      const result: DataValidationResult = {
        isValid: !needsRefetch,
        frontendCount: frontendTotal,
        databaseCount: databaseTotal,
        discrepancy,
        needsRefetch
      };

      if (needsRefetch) {
        console.error('🚨 [VALIDAÇÃO] INCONSISTÊNCIA REAL DETECTADA!', {
          frontend: frontendTotal,
          banco: databaseTotal,
          diferenca: discrepancy,
          percentual: discrepancyPercentage.toFixed(1) + '%'
        });
        
        if (onInconsistency) {
          onInconsistency(result);
        }
      }

      return result;

    } catch (error) {
      console.error('❌ [VALIDAÇÃO] Erro na validação:', error);
      return {
        isValid: false,
        frontendCount: frontendAppointments.length,
        databaseCount: 0,
        discrepancy: 0,
        needsRefetch: true
      };
    }
  }, []);

  // 🔄 RECUPERAÇÃO AUTOMÁTICA: Buscar dados direto do banco quando necessário
  const fetchCriticalData = useCallback(async (): Promise<AppointmentWithRelations[]> => {
    console.log('🔄 [RECUPERAÇÃO] Buscando dados críticos direto do banco...');

    try {
      const { data: criticalData, error } = await supabase
        .rpc('buscar_agendamentos_otimizado');

      if (error) {
        console.error('❌ [RECUPERAÇÃO] Erro na busca crítica:', error);
        throw error;
      }

      console.log('✅ [RECUPERAÇÃO] Dados críticos recuperados:', {
        total: criticalData?.length || 0,
        agendados: criticalData?.filter(apt => apt.status === 'agendado').length || 0
      });

      // Transformar dados no formato esperado
      const transformedData = (criticalData || []).map(apt => ({
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

      return transformedData;

    } catch (error) {
      console.error('❌ [RECUPERAÇÃO] Falha na recuperação crítica:', error);
      throw error;
    }
  }, []);

  return {
    validateAppointmentsData,
    fetchCriticalData
  };
}