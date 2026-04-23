// ============= TIPO DE AGENDAMENTO EFETIVO =============
// Tipos possíveis: 'ordem_chegada', 'hora_marcada', 'estimativa_horario'

import type { DynamicConfig } from './types.ts'
import { getMedicoRules } from './limites.ts'
import { formatarDataPorExtenso } from './normalizacao.ts'

export const TIPO_ORDEM_CHEGADA = 'ordem_chegada';
export const TIPO_HORA_MARCADA = 'hora_marcada';
export const TIPO_ESTIMATIVA_HORARIO = 'estimativa_horario';

/**
 * Determina o tipo de agendamento efetivo para um serviço
 * Considera herança do médico quando tipo = 'herdar' ou não definido
 *
 * @param servicoConfig - Configuração do serviço específico
 * @param medicoConfig - Configuração geral do médico (regras)
 * @returns 'ordem_chegada' | 'hora_marcada' | 'estimativa_horario'
 */
export function getTipoAgendamentoEfetivo(
  servicoConfig: any,
  medicoConfig: any
): string {
  // 1. Se serviço tem tipo próprio (não 'herdar'), usar dele
  const tipoServico = servicoConfig?.tipo_agendamento || servicoConfig?.tipo;

  if (tipoServico && tipoServico !== 'herdar' && tipoServico !== 'default') {
    console.log(`📋 [TIPO] Usando tipo do SERVIÇO: ${tipoServico}`);
    return tipoServico;
  }

  // 2. Caso contrário, herdar do médico
  const tipoMedico = medicoConfig?.tipo_agendamento || TIPO_ORDEM_CHEGADA;
  console.log(`📋 [TIPO] Herdando tipo do MÉDICO: ${tipoMedico}`);
  return tipoMedico;
}

/**
 * Verifica se o tipo de agendamento é estimativa de horário
 */
export function isEstimativaHorario(tipo: string): boolean {
  return tipo === TIPO_ESTIMATIVA_HORARIO;
}

/**
 * Verifica se o tipo de agendamento é hora marcada (exato)
 */
export function isHoraMarcada(tipo: string): boolean {
  return tipo === TIPO_HORA_MARCADA;
}

/**
 * Verifica se o tipo de agendamento é ordem de chegada
 */
export function isOrdemChegada(tipo: string): boolean {
  return tipo === TIPO_ORDEM_CHEGADA;
}

/**
 * Obtém o intervalo de minutos apropriado para o tipo de agendamento
 * - hora_marcada: usa intervalo_pacientes (padrão 30)
 * - estimativa_horario: usa intervalo_estimado (padrão 30)
 * - ordem_chegada: usa 1 minuto (para alocação sequencial)
 */
export function getIntervaloMinutos(
  tipo: string,
  servicoConfig: any,
  periodoConfig: any
): number {
  if (isOrdemChegada(tipo)) {
    return 1; // Ordem de chegada: 1 minuto de incremento
  }

  if (isEstimativaHorario(tipo)) {
    // Para estimativa, priorizar intervalo_estimado do serviço, depois do período
    return servicoConfig?.intervalo_estimado ||
           periodoConfig?.intervalo_estimado ||
           30;
  }

  // Hora marcada: usar intervalo_pacientes ou intervalo_minutos
  return servicoConfig?.intervalo_pacientes ||
         periodoConfig?.intervalo_pacientes ||
         periodoConfig?.intervalo_minutos ||
         30;
}

/**
 * Obtém a mensagem de estimativa personalizada para o tipo estimativa_horario
 */
export function getMensagemEstimativa(servicoConfig: any, periodoConfig: any): string {
  return servicoConfig?.mensagem_estimativa ||
         periodoConfig?.mensagem_estimativa ||
         'Horário aproximado, sujeito a alteração conforme ordem de atendimento.';
}

/**
 * Formata horário para exibição considerando o tipo de agendamento
 * - hora_marcada: "às 10:30"
 * - estimativa_horario: "por volta das 10:30"
 * - ordem_chegada: período de distribuição
 */
export function formatarHorarioParaExibicao(
  hora: string,
  tipo: string,
  periodoConfig?: any
): string {
  if (isOrdemChegada(tipo)) {
    const distribuicao = periodoConfig?.distribuicao_fichas ||
                         `${periodoConfig?.inicio || '08:00'} às ${periodoConfig?.fim || '12:00'}`;
    return `por ordem de chegada (${distribuicao})`;
  }

  // Formatar hora para HH:MM
  const horaFormatada = hora.substring(0, 5);

  if (isEstimativaHorario(tipo)) {
    return `por volta das ${horaFormatada}`;
  }

  // Hora marcada
  return `às ${horaFormatada}`;
}

// 🌎 Função para obter data E HORA atual no fuso horário de São Paulo
export function getDataHoraAtualBrasil() {
  const agora = new Date();
  const brasilTime = agora.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const [data, hora] = brasilTime.split(', ');
  const [dia, mes, ano] = data.split('/');
  const [horaNum, minutoNum] = hora.split(':').map(Number);

  return {
    data: `${ano}-${mes}-${dia}`,
    hora: horaNum,
    minuto: minutoNum,
    horarioEmMinutos: horaNum * 60 + minutoNum
  };
}

/**
 * 🕐 FILTRAR PERÍODOS PASSADOS DO DIA ATUAL
 * Remove períodos cujo horário de fim já passou (com antecedência mínima de 60min).
 * Para datas futuras, mantém todos os períodos.
 */
export function filtrarPeriodosPassados(
  proximasDatas: Array<{
    data: string;
    dia_semana: string;
    periodos: Array<Record<string, any>>;
  }>
): Array<{ data: string; dia_semana: string; periodos: Array<Record<string, any>> }> {
  const { data: dataAtual, horarioEmMinutos } = getDataHoraAtualBrasil();
  const ANTECEDENCIA_MIN = 60; // minutos
  const limiteMinutos = horarioEmMinutos + ANTECEDENCIA_MIN;

  return proximasDatas
    .map(dia => {
      if (dia.data !== dataAtual) return dia; // datas futuras: manter tudo

      // Para hoje: filtrar períodos cujo fim já passou
      const periodosValidos = dia.periodos.filter(p => {
        // Extrair hora de fim do campo horario_distribuicao (ex: "07:00 às 12:00")
        const match = (p.horario_distribuicao || '').match(/(\d{2}:\d{2})\s*(?:às|a|-)\s*(\d{2}:\d{2})/);
        if (!match) return true; // se não conseguir parsear, manter

        const [, , fimStr] = match;
        const [fimH, fimM] = fimStr.split(':').map(Number);
        const fimMinutos = fimH * 60 + fimM;

        // Período válido se o fim > hora atual + antecedência
        if (fimMinutos <= limiteMinutos) {
          console.log(`🕐 [FILTRO] Removendo período "${p.periodo}" de hoje (${dia.data}) — fim ${fimStr} já passou (atual+60min: ${Math.floor(limiteMinutos/60)}:${String(limiteMinutos%60).padStart(2,'0')})`);
          return false;
        }
        return true;
      });

      return { ...dia, periodos: periodosValidos };
    })
    .filter(dia => dia.periodos.length > 0); // remover dias sem períodos válidos
}

// Manter compatibilidade - retorna apenas a data
export function getDataAtualBrasil(): string {
  return getDataHoraAtualBrasil().data;
}

/**
 * 🚫 VALIDAÇÃO DE DATA/HORA FUTURA
 * Valida se a data/hora do agendamento é no futuro (timezone São Paulo)
 * @param dataAgendamento - Data no formato YYYY-MM-DD
 * @param horaAgendamento - Hora no formato HH:MM ou HH:MM:SS (opcional)
 * @returns { valido: boolean, erro?: string, dataMinima?: string, horaMinima?: string }
 */
export function validarDataHoraFutura(
  dataAgendamento: string,
  horaAgendamento?: string
): { valido: boolean; erro?: 'DATA_PASSADA' | 'HORARIO_PASSADO'; dataMinima?: string; horaMinima?: string } {
  const { data: dataAtual, hora: horaAtual, minuto: minutoAtual } = getDataHoraAtualBrasil();

  // Validar data
  if (dataAgendamento < dataAtual) {
    console.log(`🚫 [VALIDAÇÃO] Data ${dataAgendamento} está no passado (hoje: ${dataAtual})`);
    return {
      valido: false,
      erro: 'DATA_PASSADA',
      dataMinima: dataAtual
    };
  }

  // Se for hoje, validar horário (mínimo 1h de antecedência)
  if (dataAgendamento === dataAtual && horaAgendamento) {
    const [horaAg, minAg] = horaAgendamento.split(':').map(Number);
    const minutosTotaisAgendamento = horaAg * 60 + (minAg || 0);
    const minutosTotaisAtual = horaAtual * 60 + minutoAtual;

    // Mínimo 60 minutos de antecedência
    const ANTECEDENCIA_MINUTOS = 60;
    if (minutosTotaisAgendamento < minutosTotaisAtual + ANTECEDENCIA_MINUTOS) {
      const minutosTotaisMinimos = minutosTotaisAtual + ANTECEDENCIA_MINUTOS;
      const horaMinima = Math.floor(minutosTotaisMinimos / 60);
      const minutoMinimo = minutosTotaisMinimos % 60;
      const horaMinFormatada = `${horaMinima.toString().padStart(2, '0')}:${minutoMinimo.toString().padStart(2, '0')}`;

      console.log(`🚫 [VALIDAÇÃO] Horário ${horaAgendamento} muito próximo. Mínimo: ${horaMinFormatada}`);
      return {
        valido: false,
        erro: 'HORARIO_PASSADO',
        dataMinima: dataAtual,
        horaMinima: horaMinFormatada
      };
    }
  }

  console.log(`✅ [VALIDAÇÃO] Data/hora ${dataAgendamento} ${horaAgendamento || ''} OK (futura)`);
  return { valido: true };
}

/**
 * Classifica um horário de agendamento no período correto (manhã/tarde)
 * considerando margem de tolerância para ordem de chegada
 */
export function classificarPeriodoAgendamento(
  horaAgendamento: string,
  periodosConfig: any
): string | null {
  const [h, m] = horaAgendamento.split(':').map(Number);
  const minutos = h * 60 + m;

  for (const [periodo, config] of Object.entries(periodosConfig)) {
    // Priorizar campos de contagem expandida, com fallbacks para formatos legados
    // contagem_inicio/fim: intervalo completo para contar vagas (ex: 07:00-12:00)
    // inicio/fim ou horario_inicio/fim: horário de distribuição de fichas (ex: 07:30-10:00)
    const inicioStr = (config as any).contagem_inicio
      || (config as any).inicio
      || (config as any).horario_inicio;
    const fimStr = (config as any).contagem_fim
      || (config as any).fim
      || (config as any).horario_fim;

    if (!inicioStr || !fimStr) {
      console.warn(`⚠️ [CLASSIFICAR] Período ${periodo} sem horários definidos`);
      continue;
    }

    const [hInicio, mInicio] = inicioStr.split(':').map(Number);
    const [hFim, mFim] = fimStr.split(':').map(Number);
    const inicioMinutos = hInicio * 60 + mInicio;
    const fimMinutos = hFim * 60 + mFim;

    // Para ORDEM DE CHEGADA: considerar margem de 15 minutos antes do início
    // Exemplo: período de contagem 07:00-12:00 aceita agendamentos desde 06:45
    const margemMinutos = 15;

    if (minutos >= (inicioMinutos - margemMinutos) && minutos <= fimMinutos) {
      return periodo;
    }
  }

  return null;
}

// 🆕 FUNÇÃO UTILITÁRIA: Buscar próximas datas disponíveis (extraída do handler para nível do módulo)
export async function buscarProximasDatasDisponiveis(
  supabase: any,
  medico: any,
  servicoKey: string,
  servico: any,
  dataInicial: string,
  clienteId: string,
  periodoPreferido?: string,
  diasBusca: number = 60,
  maxResultados: number = 5
): Promise<Array<{
  data: string;
  dia_semana: string;
  vagas_disponiveis: number;
  total_vagas: number;
  periodo?: string;
}>> {

  const proximasDatas = [];
  const diasNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  console.log(`🔍 Buscando próximas datas disponíveis para ${medico.nome} - ${servicoKey}`);
  console.log(`📅 Data inicial: ${dataInicial}, Dias de busca: ${diasBusca}, Max resultados: ${maxResultados}`);

  for (let i = 0; i < diasBusca && proximasDatas.length < maxResultados; i++) {
    const dataFutura = new Date(dataInicial);
    dataFutura.setDate(dataFutura.getDate() + i);
    const dataFuturaStr = dataFutura.toISOString().split('T')[0];
    const diaSemana = dataFutura.getDay();

    // Pular finais de semana
    if (diaSemana === 0 || diaSemana === 6) continue;

    // Verificar se o dia é permitido para o serviço
    if (servico.dias_semana && !servico.dias_semana.includes(diaSemana)) continue;
    if (servico.dias && !servico.dias.includes(diaSemana)) continue;

    // Verificar bloqueios
    const { data: bloqueios } = await supabase
      .from('bloqueios_agenda')
      .select('id')
      .eq('medico_id', medico.id)
      .eq('cliente_id', clienteId)
      .eq('status', 'ativo')
      .lte('data_inicio', dataFuturaStr)
      .gte('data_fim', dataFuturaStr);

    if (bloqueios && bloqueios.length > 0) continue;

    // Verificar disponibilidade por período
    const periodos = servico.periodos || {};
    const periodosParaVerificar = periodoPreferido
      ? (periodos[periodoPreferido] ? [periodoPreferido] : Object.keys(periodos))
      : Object.keys(periodos);

    for (const periodo of periodosParaVerificar) {
      const config = periodos[periodo];
      if (!config) continue;

      // Verificar dias específicos do período
      if (config.dias_especificos && !config.dias_especificos.includes(diaSemana)) continue;

      // Contar agendamentos existentes
      const { data: agendamentos } = await supabase
        .from('agendamentos')
        .select('hora_agendamento')
        .eq('medico_id', medico.id)
        .eq('cliente_id', clienteId)
        .eq('data_agendamento', dataFuturaStr)
        .in('status', ['agendado', 'confirmado']);

      let vagasOcupadas = 0;
      if (agendamentos && agendamentos.length > 0) {
        // Usar contagem_inicio/contagem_fim se configurados, senão hora_inicio/hora_fim
        const horaInicioContagem = (config as any).contagem_inicio || (config as any).hora_inicio;
        const horaFimContagem = (config as any).contagem_fim || (config as any).hora_fim;

        if (horaInicioContagem && horaFimContagem) {
          const [horaInicio] = horaInicioContagem.split(':').map(Number);
          const [horaFim] = horaFimContagem.split(':').map(Number);

          vagasOcupadas = agendamentos.filter(ag => {
            const [horaAg] = ag.hora_agendamento.split(':').map(Number);
            return horaAg >= horaInicio && horaAg < horaFim;
          }).length;
        } else {
          vagasOcupadas = agendamentos.length;
        }
      }

      const vagasDisponiveis = (config as any).limite - vagasOcupadas;

      if (vagasDisponiveis > 0) {
        const periodoNome = periodo === 'manha' ? 'Manhã' : 'Tarde';
        console.log(`✅ ${dataFuturaStr} (${diasNomes[diaSemana]}) - ${vagasDisponiveis} vaga(s) - ${periodoNome}`);

        proximasDatas.push({
          data: dataFuturaStr,
          dia_semana: diasNomes[diaSemana],
          vagas_disponiveis: vagasDisponiveis,
          total_vagas: (config as any).limite,
          periodo: periodoNome
        });

        if (proximasDatas.length >= maxResultados) {
          return proximasDatas;
        }

        // Não buscar outros períodos da mesma data
        break;
      }
    }
  }

  return proximasDatas;
}

// Regras de negócio FALLBACK genérico (usado apenas se não houver regras no banco)
// As regras específicas de cada clínica (incluindo IPADO) estão na tabela business_rules
export const BUSINESS_RULES = {
  medicos: {} as Record<string, any>
};

function montarMensagemConsulta(
  agendamento: any,
  regras: any,
  periodoConfig: any,
  isOC: boolean
): string {
  const dataFormatada = formatarDataPorExtenso(agendamento.data_agendamento);
  const periodo = periodoConfig.distribuicao_fichas ||
                  `${periodoConfig.inicio} às ${periodoConfig.fim}`;

  let mensagem = `O(a) paciente ${agendamento.paciente_nome} tem uma consulta agendada para o dia ${dataFormatada}`;

  if (isOC) {
    // Horário de chegada para fazer a ficha (contagem_inicio)
    const horarioFicha = periodoConfig.contagem_inicio || periodoConfig.inicio;
    if (horarioFicha) {
      mensagem += `. Chegar a partir das ${horarioFicha} para fazer a ficha`;
    } else {
      mensagem += ` no horário de ${periodo}`;
    }

    // Nome do médico com fallback
    const nomeMedico = agendamento.medico_nome || regras.nome || 'O médico';
    if (periodoConfig.atendimento_inicio) {
      mensagem += `. ${nomeMedico} começa a atender às ${periodoConfig.atendimento_inicio}, por ordem de chegada`;
    } else {
      mensagem += `, por ordem de chegada`;
    }
  } else {
    mensagem += ` às ${agendamento.hora_agendamento}`;
  }

  // Adicionar informação sobre pagamento Unimed
  if (agendamento.convenio && agendamento.convenio.toLowerCase().includes('unimed')) {
    mensagem += `. Caso o plano Unimed seja coparticipação ou particular, recebemos apenas em espécie`;
  }

  return mensagem + '.';
}

/**
 * Formata consulta com contexto de regras de negócio (períodos, ordem de chegada, etc)
 */
export function formatarConsultaComContexto(agendamento: any, config: DynamicConfig | null): any {
  // 1. Buscar regras do médico (dinâmico primeiro, fallback para hardcoded)
  const regras = getMedicoRules(config, agendamento.medico_id, BUSINESS_RULES.medicos[agendamento.medico_id]);

  // 2. Se não tem regras, retornar formato simples
  if (!regras) {
    return {
      ...agendamento,
      horario_formatado: agendamento.hora_agendamento,
      mensagem: `Consulta agendada para ${formatarDataPorExtenso(agendamento.data_agendamento)} às ${agendamento.hora_agendamento}.`
    };
  }

  // 3. Identificar o serviço/atendimento
  const servicoKey = Object.keys(regras.servicos).find(s => {
    const atendimentoNome = agendamento.atendimento_nome?.toLowerCase() || '';
    return atendimentoNome.includes(s.toLowerCase()) || s.toLowerCase().includes(atendimentoNome);
  });

  if (!servicoKey) {
    // Fallback: se médico é ordem_chegada, tentar usar períodos de qualquer serviço
    if (regras.tipo_agendamento === 'ordem_chegada') {
      const primeiroServicoComPeriodos = Object.values(regras.servicos)
        .find((s: any) => s.periodos && Object.keys(s.periodos).length > 0);

      if (primeiroServicoComPeriodos) {
        const periodoFallback = classificarPeriodoAgendamento(
          agendamento.hora_agendamento,
          (primeiroServicoComPeriodos as any).periodos
        );
        if (periodoFallback) {
          const periodoConfigFallback = (primeiroServicoComPeriodos as any).periodos[periodoFallback];
          const mensagemFallback = montarMensagemConsulta(agendamento, regras, periodoConfigFallback, true);
          return {
            ...agendamento,
            periodo: periodoConfigFallback.distribuicao_fichas || `${periodoConfigFallback.inicio} às ${periodoConfigFallback.fim}`,
            atendimento_inicio: periodoConfigFallback.atendimento_inicio,
            tipo_agendamento: 'ordem_chegada',
            mensagem: mensagemFallback
          };
        }
      }
    }
    return {
      ...agendamento,
      horario_formatado: agendamento.hora_agendamento,
      mensagem: `Consulta agendada para ${formatarDataPorExtenso(agendamento.data_agendamento)} às ${agendamento.hora_agendamento}.`
    };
  }

  const servico = regras.servicos[servicoKey];

  // 4. Usar classificarPeriodoAgendamento para identificar o período
  const periodo = classificarPeriodoAgendamento(
    agendamento.hora_agendamento,
    servico.periodos
  );

  if (!periodo) {
    // Mesmo fallback para período não encontrado em ordem_chegada
    if (regras.tipo_agendamento === 'ordem_chegada' || servico.tipo === 'ordem_chegada') {
      const primeiroServicoComPeriodos2 = Object.values(regras.servicos)
        .find((s: any) => s.periodos && Object.keys(s.periodos).length > 0);
      if (primeiroServicoComPeriodos2) {
        const periodoFallback2 = classificarPeriodoAgendamento(
          agendamento.hora_agendamento,
          (primeiroServicoComPeriodos2 as any).periodos
        );
        if (periodoFallback2) {
          const pc2 = (primeiroServicoComPeriodos2 as any).periodos[periodoFallback2];
          const msg2 = montarMensagemConsulta(agendamento, regras, pc2, true);
          return {
            ...agendamento,
            periodo: pc2.distribuicao_fichas || `${pc2.inicio} às ${pc2.fim}`,
            atendimento_inicio: pc2.atendimento_inicio,
            tipo_agendamento: 'ordem_chegada',
            mensagem: msg2
          };
        }
      }
    }
    return {
      ...agendamento,
      horario_formatado: agendamento.hora_agendamento,
      mensagem: `Consulta agendada para ${formatarDataPorExtenso(agendamento.data_agendamento)} às ${agendamento.hora_agendamento}.`
    };
  }

  const periodoConfig = servico.periodos[periodo];

  // 5. Montar mensagem contextual
  const mensagem = montarMensagemConsulta(
    agendamento,
    regras,
    periodoConfig,
    servico.tipo === 'ordem_chegada'
  );

  return {
    ...agendamento,
    periodo: periodoConfig.distribuicao_fichas || `${periodoConfig.inicio} às ${periodoConfig.fim}`,
    atendimento_inicio: periodoConfig.atendimento_inicio,
    tipo_agendamento: servico.tipo,
    mensagem
  };
}

// Função auxiliar para calcular idade
export function calcularIdade(dataNascimento: string): number {
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
}

/**
 * Busca o próximo horário livre no mesmo dia e período (incremento de 1 minuto)
 * @returns { horario: string, tentativas: number } ou null se período lotado
 */
export async function buscarProximoHorarioLivre(
  supabase: any,
  clienteId: string,
  medicoId: string,
  dataConsulta: string,
  horarioInicial: string, // ex: "08:00:00"
  periodoConfig: { inicio: string, fim: string, limite: number, intervalo_minutos?: number, contagem_inicio?: string, contagem_fim?: string }
): Promise<{ horario: string, tentativas: number } | null> {

  const [horaInicio, minInicio] = periodoConfig.inicio.split(':').map(Number);
  const [horaFim, minFim] = periodoConfig.fim.split(':').map(Number);

  // Converter para minutos desde meia-noite (para exibição e alocação)
  const minutoInicio = horaInicio * 60 + minInicio;
  const minutoFim = horaFim * 60 + minFim;

  // 🆕 Usar contagem_inicio/contagem_fim se configurados, senão fallback para inicio/fim
  const inicioContagem = periodoConfig.contagem_inicio || periodoConfig.inicio;
  const fimContagem = periodoConfig.contagem_fim || periodoConfig.fim;
  const [horaInicioContagem, minInicioContagem] = inicioContagem.split(':').map(Number);
  const [horaFimContagem, minFimContagem] = fimContagem.split(':').map(Number);
  const minutoInicioContagem = horaInicioContagem * 60 + minInicioContagem;
  const minutoFimContagem = horaFimContagem * 60 + minFimContagem;

  console.log(`🔢 [CONTAGEM] Período exibição: ${periodoConfig.inicio}-${periodoConfig.fim}`);
  console.log(`🔢 [CONTAGEM] Período contagem: ${inicioContagem}-${fimContagem}`);

  // Buscar TODOS os agendamentos do dia para esse médico
  const { data: agendamentosDia } = await supabase
    .from('agendamentos')
    .select('hora_agendamento')
    .eq('medico_id', medicoId)
    .eq('data_agendamento', dataConsulta)
    .eq('cliente_id', clienteId)
    .in('status', ['agendado', 'confirmado']);

  // 🆕 FILTRAR AGENDAMENTOS USANDO OS HORÁRIOS DE CONTAGEM
  const agendamentos = agendamentosDia?.filter(a => {
    const [h, m] = a.hora_agendamento.split(':').map(Number);
    const minutoAgendamento = h * 60 + m;
    return minutoAgendamento >= minutoInicioContagem && minutoAgendamento < minutoFimContagem;
  }) || [];

  console.log(`📊 Agendamentos totais do dia: ${agendamentosDia?.length || 0}`);
  console.log(`📊 Agendamentos no período de contagem (${inicioContagem}-${fimContagem}): ${agendamentos.length}/${periodoConfig.limite}`);

  // Verificar se já atingiu o limite de vagas DO PERÍODO
  if (agendamentos.length >= periodoConfig.limite) {
    console.log(`❌ Período ${periodoConfig.inicio}-${periodoConfig.fim} está lotado (${agendamentos.length}/${periodoConfig.limite})`);
    return null;
  }

  console.log(`✅ Vagas disponíveis no período: ${agendamentos.length}/${periodoConfig.limite}`);

  // Criar Set de horários ocupados para busca rápida (formato HH:MM)
  const horariosOcupados = new Set(
    agendamentos?.map(a => a.hora_agendamento.substring(0, 5)) || []
  );

  // 🔄 BUSCAR MINUTO A MINUTO até encontrar horário livre
  let tentativas = 0;
  let minutoAtual = minutoInicio;

  while (minutoAtual < minutoFim) {
    tentativas++;
    const hora = Math.floor(minutoAtual / 60);
    const min = minutoAtual % 60;
    const horarioTeste = `${String(hora).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

    if (!horariosOcupados.has(horarioTeste)) {
      console.log(`✅ Horário livre encontrado: ${horarioTeste} (após ${tentativas} tentativas)`);
      return { horario: horarioTeste + ':00', tentativas };
    }

    // Avançar 1 minuto
    minutoAtual++;
  }

  console.log(`❌ Nenhum horário livre encontrado após ${tentativas} tentativas`);
  return null;
}
