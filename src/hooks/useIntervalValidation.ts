import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, parseISO } from 'date-fns';

interface IntervalRule {
  exame_origem: string[];
  exame_bloqueado: string[];
  intervalo_dias: number;
  mensagem: string;
}

interface IntervalRules {
  [key: string]: IntervalRule;
}

interface UnimedRules {
  consulta_sempre_com_ecg?: boolean;
  mapa_holter_nao_aceita?: boolean;
  observacao?: string;
}

interface SpecialRules {
  regras_intervalos?: IntervalRules;
  regras_unimed?: UnimedRules;
}

interface IntervalValidationResult {
  isValid: boolean;
  message: string | null;
  blockingAppointment?: {
    data: string;
    exame: string;
    diasRestantes: number;
  };
}

interface UnimedValidationResult {
  showWarning: boolean;
  messages: string[];
  blockExam: boolean;
}

export function useIntervalValidation(medicoId: string | undefined) {
  const [specialRules, setSpecialRules] = useState<SpecialRules | null>(null);
  const [loading, setLoading] = useState(false);

  // Buscar regras especiais do médico
  useEffect(() => {
    if (!medicoId) {
      setSpecialRules(null);
      return;
    }

    const fetchRules = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('business_rules')
          .select('config')
          .eq('medico_id', medicoId)
          .single();

        if (error) {
          console.log('Nenhuma regra especial encontrada para o médico');
          setSpecialRules(null);
          return;
        }

        const config = data?.config as Record<string, unknown>;
        const regrasEspeciais = config?.regras_especiais as SpecialRules | undefined;
        
        if (regrasEspeciais) {
          console.log('📋 Regras especiais carregadas:', regrasEspeciais);
          setSpecialRules(regrasEspeciais);
        } else {
          setSpecialRules(null);
        }
      } catch (err) {
        console.error('Erro ao buscar regras especiais:', err);
        setSpecialRules(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRules();
  }, [medicoId]);

  // Validar intervalo entre exames
  const validateExamInterval = useCallback(async (
    pacienteTelefone: string,
    exameNome: string,
    dataAgendamento: string
  ): Promise<IntervalValidationResult> => {
    if (!specialRules?.regras_intervalos || !pacienteTelefone || !exameNome || !dataAgendamento) {
      return { isValid: true, message: null };
    }

    // Verificar se o exame selecionado é um exame bloqueado em alguma regra
    for (const [ruleKey, rule] of Object.entries(specialRules.regras_intervalos)) {
      const isExameBloqueado = rule.exame_bloqueado.some(
        bloqueado => exameNome.toLowerCase().includes(bloqueado.toLowerCase())
      );

      if (isExameBloqueado) {
        // Buscar agendamentos anteriores do paciente com exames de origem
        try {
          const { data: agendamentos, error } = await supabase
            .from('agendamentos')
            .select(`
              id,
              data_agendamento,
              atendimentos!inner(nome)
            `)
            .or(`pacientes.telefone.eq.${pacienteTelefone},pacientes.celular.eq.${pacienteTelefone}`)
            .neq('status', 'cancelado')
            .neq('status', 'cancelado_bloqueio')
            .order('data_agendamento', { ascending: false })
            .limit(50);

          if (error) {
            console.error('Erro ao buscar agendamentos anteriores:', error);
            return { isValid: true, message: null };
          }

          // Verificar se há algum agendamento recente com exame de origem
          for (const agendamento of agendamentos || []) {
            const atendimentoNome = (agendamento.atendimentos as { nome: string })?.nome || '';
            
            const isExameOrigem = rule.exame_origem.some(
              origem => atendimentoNome.toLowerCase().includes(origem.toLowerCase())
            );

            if (isExameOrigem) {
              const dataAnterior = parseISO(agendamento.data_agendamento);
              const dataNova = parseISO(dataAgendamento);
              const diasDiferenca = Math.abs(differenceInDays(dataNova, dataAnterior));

              if (diasDiferenca < rule.intervalo_dias) {
                const diasRestantes = rule.intervalo_dias - diasDiferenca;
                return {
                  isValid: false,
                  message: rule.mensagem,
                  blockingAppointment: {
                    data: agendamento.data_agendamento,
                    exame: atendimentoNome,
                    diasRestantes
                  }
                };
              }
            }
          }
        } catch (err) {
          console.error('Erro na validação de intervalo:', err);
        }
      }
    }

    return { isValid: true, message: null };
  }, [specialRules]);

  // Validar regras UNIMED
  const validateUnimedRules = useCallback((
    convenio: string,
    exameNome: string
  ): UnimedValidationResult => {
    const result: UnimedValidationResult = {
      showWarning: false,
      messages: [],
      blockExam: false
    };

    if (!specialRules?.regras_unimed || !convenio) {
      return result;
    }

    const isUnimed = convenio.toLowerCase().includes('unimed');
    if (!isUnimed) {
      return result;
    }

    const rules = specialRules.regras_unimed;

    // Verificar se MAPA/HOLTER não são aceitos
    if (rules.mapa_holter_nao_aceita) {
      const isMapaHolter = 
        exameNome.toLowerCase().includes('mapa') || 
        exameNome.toLowerCase().includes('holter');
      
      if (isMapaHolter) {
        result.showWarning = true;
        result.blockExam = true;
        result.messages.push('⚠️ UNIMED não cobre MAPA/HOLTER. Agendar como particular ou outro convênio.');
      }
    }

    // Verificar regra de consulta sempre com ECG
    if (rules.consulta_sempre_com_ecg) {
      const isConsulta = exameNome.toLowerCase().includes('consulta');
      if (isConsulta) {
        result.showWarning = true;
        result.messages.push('💡 Paciente UNIMED: Agendar consulta SEMPRE junto com ECG.');
      }
    }

    // Adicionar observação geral se houver
    if (rules.observacao && result.showWarning) {
      result.messages.push(`ℹ️ ${rules.observacao}`);
    }

    return result;
  }, [specialRules]);

  return {
    specialRules,
    loading,
    validateExamInterval,
    validateUnimedRules,
    hasIntervalRules: !!specialRules?.regras_intervalos,
    hasUnimedRules: !!specialRules?.regras_unimed
  };
}
