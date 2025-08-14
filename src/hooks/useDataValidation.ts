import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppointmentWithRelations } from '@/types/scheduling';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();

  // 🔍 VALIDAÇÃO CRÍTICA: Comparar dados frontend vs banco
  const validateAppointmentsData = useCallback(async (
    frontendAppointments: AppointmentWithRelations[]
  ): Promise<DataValidationResult> => {
    try {
      console.log('🔍 [VALIDAÇÃO] Iniciando validação de integridade de dados...');

      // Contar agendamentos no frontend
      const frontendTotal = frontendAppointments.length;
      const frontendAgendados = frontendAppointments.filter(apt => apt.status === 'agendado').length;

      console.log('🔍 [VALIDAÇÃO] Dados do frontend:', {
        total: frontendTotal,
        agendados: frontendAgendados
      });

      // Buscar contadores direto do banco (query rápida)
      const { data: dbCount, error } = await supabase
        .from('agendamentos')
        .select('status', { count: 'exact', head: true })
        .neq('status', 'cancelado');

      if (error) {
        console.error('❌ [VALIDAÇÃO] Erro ao contar registros no banco:', error);
        throw error;
      }

      // Contar agendados especificamente
      const { count: dbAgendadosCount } = await supabase
        .from('agendamentos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'agendado');

      const databaseTotal = dbCount || 0;
      const databaseAgendados = dbAgendadosCount || 0;

      console.log('🔍 [VALIDAÇÃO] Dados do banco:', {
        total: databaseTotal,
        agendados: databaseAgendados
      });

      const discrepancy = Math.abs(frontendAgendados - databaseAgendados);
      const discrepancyPercentage = databaseAgendados > 0 ? (discrepancy / databaseAgendados) * 100 : 0;

      // 🚨 CRITÉRIO: Mais de 5% de diferença ou mais de 50 registros
      const needsRefetch = discrepancy > 50 || discrepancyPercentage > 5;

      const result: DataValidationResult = {
        isValid: !needsRefetch,
        frontendCount: frontendAgendados,
        databaseCount: databaseAgendados,
        discrepancy,
        needsRefetch
      };

      console.log('🔍 [VALIDAÇÃO] Resultado da validação:', {
        ...result,
        discrepancyPercentage: discrepancyPercentage.toFixed(2) + '%'
      });

      if (needsRefetch) {
        console.error('🚨 [VALIDAÇÃO] INCONSISTÊNCIA DETECTADA!', result);
        
        toast({
          title: '⚠️ Dados inconsistentes detectados',
          description: `Frontend: ${frontendAgendados} vs Banco: ${databaseAgendados} agendamentos`,
          variant: 'destructive',
        });
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
  }, [toast]);

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