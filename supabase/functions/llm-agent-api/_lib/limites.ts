// ============= SISTEMA DE LIMITES COMPARTILHADOS E SUBLIMITES =============

import type { DynamicConfig, LimiteCompartilhadoResult, ConvenioSublimiteResult } from './types.ts'
import { normalizarServicoPeriodos } from './config.ts'
import { formatarDataPorExtenso } from './normalizacao.ts'

/**
 * Encontra o pool (período) que contém um determinado serviço para um dia específico
 * @param periodos - Configuração de períodos do médico
 * @param servicoKey - Chave do serviço (ex: 'ligadura_hemorroidas')
 * @param diaSemana - Dia da semana (0=dom, 1=seg, ..., 6=sab)
 * @returns Nome do pool e sua configuração, ou null se não encontrado
 */
export function encontrarPoolParaServico(
  periodos: Record<string, any> | null | undefined,
  servicoKey: string,
  diaSemana: number
): { poolNome: string; poolConfig: any } | null {
  if (!periodos) return null;

  const servicoKeyNormalizado = servicoKey.toLowerCase().replace(/[^a-z0-9_]/g, '_');

  for (const [poolNome, poolConfig] of Object.entries(periodos)) {
    // Verificar se o pool atende neste dia
    const diasPool = poolConfig.dias || [];
    if (!diasPool.includes(diaSemana)) continue;

    // Verificar se o serviço está no pool
    const servicosPool = poolConfig.servicos || [];
    const servicoNoPool = servicosPool.some((s: string) =>
      s.toLowerCase().replace(/[^a-z0-9_]/g, '_') === servicoKeyNormalizado ||
      servicoKeyNormalizado.includes(s.toLowerCase().replace(/[^a-z0-9_]/g, '_')) ||
      s.toLowerCase().replace(/[^a-z0-9_]/g, '_').includes(servicoKeyNormalizado)
    );

    if (servicoNoPool && poolConfig.limite_pacientes) {
      console.log(`🔍 [POOL] Serviço "${servicoKey}" encontrado no pool "${poolNome}" para dia ${diaSemana}`);
      return { poolNome, poolConfig };
    }
  }

  return null;
}

/**
 * Verifica se um serviço pode ser agendado considerando:
 * 1. Limite do pool compartilhado (se configurado)
 * 2. Sublimite próprio do serviço (se configurado)
 *
 * @returns Objeto indicando se permitido ou detalhes do bloqueio
 */
export async function verificarLimitesCompartilhados(
  supabase: any,
  clienteId: string,
  medicoId: string,
  dataAgendamento: string,
  servicoKey: string,
  servicoConfig: any,
  regras: any
): Promise<LimiteCompartilhadoResult> {
  console.log(`\n🔐 [LIMITES] Verificando limites para serviço "${servicoKey}" em ${dataAgendamento}...`);

  // Obter dia da semana
  const [ano, mes, dia] = dataAgendamento.split('-').map(Number);
  const diaSemana = new Date(ano, mes - 1, dia).getDay();

  const periodos = regras?.periodos;
  const compartilhaLimiteCom = servicoConfig?.compartilha_limite_com;
  const limiteProprio = servicoConfig?.limite_proprio;

  console.log(`📋 [LIMITES] compartilha_limite_com: ${compartilhaLimiteCom || 'N/A'}, limite_proprio: ${limiteProprio || 'N/A'}`);

  // 1. VERIFICAR LIMITE DO POOL COMPARTILHADO
  if (compartilhaLimiteCom && periodos) {
    // Encontrar o pool que contém o serviço principal (com quem compartilha)
    const poolInfo = encontrarPoolParaServico(periodos, compartilhaLimiteCom, diaSemana);

    if (poolInfo) {
      const { poolNome, poolConfig } = poolInfo;
      const servicosPool = poolConfig.servicos || [];
      const limitePool = poolConfig.limite_pacientes;

      console.log(`📊 [POOL] "${poolNome}": limite=${limitePool}, serviços=${servicosPool.join(', ')}`);

      // Buscar atendimento_ids dos serviços do pool
      const servicosNormalizados = servicosPool.map((s: string) =>
        s.toLowerCase().replace(/[^a-z0-9_]/g, '_')
      );

      // Buscar todos os atendimentos que correspondem aos serviços do pool
      const { data: atendimentosPool } = await supabase
        .from('atendimentos')
        .select('id, nome')
        .eq('medico_id', medicoId)
        .eq('cliente_id', clienteId)
        .eq('ativo', true);

      const atendimentoIdsPool: string[] = [];
      if (atendimentosPool) {
        for (const atend of atendimentosPool) {
          const nomeNorm = atend.nome.toLowerCase().replace(/[^a-z0-9_]/g, '_');
          if (servicosNormalizados.some((s: string) => nomeNorm.includes(s) || s.includes(nomeNorm))) {
            atendimentoIdsPool.push(atend.id);
            console.log(`  → Atendimento "${atend.nome}" (${atend.id}) incluído no pool`);
          }
        }
      }

      // Contar agendamentos do pool inteiro
      let poolOcupado = 0;
      if (atendimentoIdsPool.length > 0) {
        const { count } = await supabase
          .from('agendamentos')
          .select('*', { count: 'exact', head: true })
          .eq('medico_id', medicoId)
          .eq('data_agendamento', dataAgendamento)
          .eq('cliente_id', clienteId)
          .in('atendimento_id', atendimentoIdsPool)
          .is('excluido_em', null)
          .is('cancelado_em', null)
          .in('status', ['agendado', 'confirmado']);

        poolOcupado = count || 0;
      }

      console.log(`📊 [POOL] Ocupação: ${poolOcupado}/${limitePool}`);

      if (poolOcupado >= limitePool) {
        console.log(`❌ [POOL] Limite do pool "${poolNome}" ATINGIDO!`);
        return {
          permitido: false,
          erro_codigo: 'LIMITE_POOL_ATINGIDO',
          mensagem: `Limite de ${limitePool} atendimentos atingido para ${formatarDataPorExtenso(dataAgendamento)}. O horário compartilha vagas com consultas e retornos.`,
          detalhes: {
            pool_nome: poolNome,
            pool_limite: limitePool,
            pool_ocupado: poolOcupado,
            servicos_pool: servicosPool
          }
        };
      }

      console.log(`✅ [POOL] Vagas disponíveis: ${limitePool - poolOcupado}`);
    }
  }

  // 2. VERIFICAR SUBLIMITE PRÓPRIO DO SERVIÇO
  if (limiteProprio && limiteProprio > 0) {
    console.log(`🔍 [SUBLIMITE] Verificando sublimite de ${limiteProprio} para "${servicoKey}"...`);

    // Buscar atendimento_id específico deste serviço
    const atendimentoId = servicoConfig?.atendimento_id;

    if (atendimentoId) {
      const { count } = await supabase
        .from('agendamentos')
        .select('*', { count: 'exact', head: true })
        .eq('medico_id', medicoId)
        .eq('data_agendamento', dataAgendamento)
        .eq('cliente_id', clienteId)
        .eq('atendimento_id', atendimentoId)
        .is('excluido_em', null)
        .is('cancelado_em', null)
        .in('status', ['agendado', 'confirmado']);

      const sublimiteOcupado = count || 0;
      console.log(`📊 [SUBLIMITE] "${servicoKey}": ${sublimiteOcupado}/${limiteProprio}`);

      if (sublimiteOcupado >= limiteProprio) {
        console.log(`❌ [SUBLIMITE] Limite próprio de "${servicoKey}" ATINGIDO!`);
        return {
          permitido: false,
          erro_codigo: 'SUBLIMITE_PROPRIO_ATINGIDO',
          mensagem: `Limite de ${limiteProprio} ${servicoKey.replace(/_/g, ' ')} por dia já foi atingido para ${formatarDataPorExtenso(dataAgendamento)}.`,
          detalhes: {
            sublimite: limiteProprio,
            sublimite_ocupado: sublimiteOcupado
          }
        };
      }

      console.log(`✅ [SUBLIMITE] Disponível: ${limiteProprio - sublimiteOcupado}`);
    } else {
      console.log(`⚠️ [SUBLIMITE] atendimento_id não configurado para "${servicoKey}", pulando verificação`);
    }
  }

  console.log(`✅ [LIMITES] Serviço "${servicoKey}" PERMITIDO para ${dataAgendamento}\n`);
  return { permitido: true };
}

/**
 * Verifica vagas disponíveis considerando limites compartilhados
 * Retorna quantas vagas reais estão disponíveis para um serviço
 */
export async function calcularVagasDisponiveisComLimites(
  supabase: any,
  clienteId: string,
  medicoId: string,
  dataAgendamento: string,
  servicoKey: string,
  servicoConfig: any,
  regras: any
): Promise<number> {
  // Verificar se os limites permitem agendamento
  const resultado = await verificarLimitesCompartilhados(
    supabase, clienteId, medicoId, dataAgendamento, servicoKey, servicoConfig, regras
  );

  if (!resultado.permitido) {
    return 0;
  }

  // Se passou nas verificações, há pelo menos 1 vaga
  // Calcular quantas vagas reais existem considerando ambos os limites
  const periodos = regras?.periodos;
  const compartilhaLimiteCom = servicoConfig?.compartilha_limite_com;
  const limiteProprio = servicoConfig?.limite_proprio;

  let vagasPool = Infinity;
  let vagasSublimite = Infinity;

  // Obter dia da semana
  const [ano, mes, dia] = dataAgendamento.split('-').map(Number);
  const diaSemana = new Date(ano, mes - 1, dia).getDay();

  // Calcular vagas do pool
  if (compartilhaLimiteCom && periodos) {
    const poolInfo = encontrarPoolParaServico(periodos, compartilhaLimiteCom, diaSemana);
    if (poolInfo) {
      const { poolConfig } = poolInfo;
      const servicosPool = poolConfig.servicos || [];
      const limitePool = poolConfig.limite_pacientes;

      // Buscar atendimento_ids dos serviços do pool
      const { data: atendimentosPool } = await supabase
        .from('atendimentos')
        .select('id, nome')
        .eq('medico_id', medicoId)
        .eq('cliente_id', clienteId)
        .eq('ativo', true);

      const atendimentoIdsPool: string[] = [];
      if (atendimentosPool) {
        for (const atend of atendimentosPool) {
          const nomeNorm = atend.nome.toLowerCase().replace(/[^a-z0-9_]/g, '_');
          const servicosNorm = servicosPool.map((s: string) => s.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
          if (servicosNorm.some((s: string) => nomeNorm.includes(s) || s.includes(nomeNorm))) {
            atendimentoIdsPool.push(atend.id);
          }
        }
      }

      if (atendimentoIdsPool.length > 0) {
        const { count } = await supabase
          .from('agendamentos')
          .select('*', { count: 'exact', head: true })
          .eq('medico_id', medicoId)
          .eq('data_agendamento', dataAgendamento)
          .eq('cliente_id', clienteId)
          .in('atendimento_id', atendimentoIdsPool)
          .is('excluido_em', null)
          .is('cancelado_em', null)
          .in('status', ['agendado', 'confirmado']);

        vagasPool = limitePool - (count || 0);
      }
    }
  }

  // Calcular vagas do sublimite
  if (limiteProprio && servicoConfig?.atendimento_id) {
    const { count } = await supabase
      .from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .eq('medico_id', medicoId)
      .eq('data_agendamento', dataAgendamento)
      .eq('cliente_id', clienteId)
      .eq('atendimento_id', servicoConfig.atendimento_id)
      .is('excluido_em', null)
      .is('cancelado_em', null)
      .in('status', ['agendado', 'confirmado']);

    vagasSublimite = limiteProprio - (count || 0);
  }

  // Retornar o menor valor (mais restritivo)
  return Math.min(vagasPool, vagasSublimite);
}

/**
 * Verifica se o sublimite de um convênio específico foi atingido para um turno.
 * Ex: HGU max 18 pacientes/turno mesmo que o turno total aceite 25.
 * Busca `convenio_sublimites` na config do médico (business_rules).
 */
export async function verificarSublimiteConvenio(
  supabase: any,
  clienteId: string,
  medicoId: string,
  dataAgendamento: string,
  convenio: string | null | undefined,
  regras: any,
  periodo?: string,
  servicoConfig?: any,
  excludeAgendamentoId?: string
): Promise<ConvenioSublimiteResult> {
  if (!convenio) return { permitido: true };

  const convenioSublimites: Record<string, number> = regras?.convenio_sublimites || {};
  if (Object.keys(convenioSublimites).length === 0) return { permitido: true };

  const convenioNorm = convenio.toUpperCase().trim().replace(/[-_]/g, ' ');
  let sublimite: number | null = null;
  let convenioKey = '';

  for (const [key, limite] of Object.entries(convenioSublimites)) {
    const keyNorm = key.toUpperCase().trim().replace(/[-_]/g, ' ');
    if (keyNorm === convenioNorm || keyNorm.includes(convenioNorm) || convenioNorm.includes(keyNorm)) {
      sublimite = limite;
      convenioKey = key;
      break;
    }
  }

  if (sublimite === null) return { permitido: true };

  console.log(`🔍 [CONVENIO SUBLIMITE] Verificando sublimite de ${sublimite} para "${convenioKey}" em ${dataAgendamento}...`);

  // Determinar faixa de horário do período
  const servicoNorm = servicoConfig ? normalizarServicoPeriodos(servicoConfig) : null;
  let inicioContagem: string | null = null;
  let fimContagem: string | null = null;

  if (periodo && servicoNorm?.periodos?.[periodo]) {
    const configPeriodo = servicoNorm.periodos[periodo];
    inicioContagem = configPeriodo.contagem_inicio || configPeriodo.inicio;
    fimContagem = configPeriodo.contagem_fim || configPeriodo.fim;
  }

  let query = supabase
    .from('agendamentos')
    .select('id', { count: 'exact', head: true })
    .eq('medico_id', medicoId)
    .eq('data_agendamento', dataAgendamento)
    .eq('cliente_id', clienteId)
    .is('excluido_em', null)
    .is('cancelado_em', null)
    .in('status', ['agendado', 'confirmado'])
    .ilike('convenio', `%${convenioKey}%`);

  if (inicioContagem && fimContagem) {
    query = query.gte('hora_agendamento', inicioContagem).lt('hora_agendamento', fimContagem);
  }
  if (excludeAgendamentoId) {
    query = query.neq('id', excludeAgendamentoId);
  }

  const { count, error } = await query;
  if (error) {
    console.error(`❌ [CONVENIO SUBLIMITE] Erro:`, error);
    return { permitido: true };
  }

  const ocupado = count || 0;
  const limiteGeralTurno = regras?.limite_por_turno || 25;
  console.log(`📊 [CONVENIO SUBLIMITE] "${convenioKey}": ${ocupado}/${sublimite} (turno geral: ${limiteGeralTurno})`);

  if (ocupado >= sublimite) {
    console.log(`❌ [CONVENIO SUBLIMITE] Limite de ${convenioKey} ATINGIDO! ${ocupado}/${sublimite}`);
    return {
      permitido: false,
      erro_codigo: 'SUBLIMITE_CONVENIO_ATINGIDO',
      mensagem: `O limite de ${sublimite} pacientes ${convenioKey} por turno já foi atingido para ${formatarDataPorExtenso(dataAgendamento)}. O médico atende até ${limiteGeralTurno} pacientes no total, mas apenas ${sublimite} podem ser ${convenioKey}.`,
      detalhes: { convenio: convenioKey, sublimite, ocupado, limite_geral_turno: limiteGeralTurno }
    };
  }

  console.log(`✅ [CONVENIO SUBLIMITE] "${convenioKey}" OK: ${sublimite - ocupado} vaga(s) restante(s)`);
  return { permitido: true };
}

// 🚨 VALORES HARDCODED (fallback quando banco não disponível)
export const FALLBACK_PHONE = ''; // Vazio para forçar uso de mensagem genérica
export const FALLBACK_DIAS_BUSCA_INICIAL = 14;
export const FALLBACK_DIAS_BUSCA_EXPANDIDA = 45;

/**
 * Retorna data mínima de agendamento (null = sem restrição)
 */
export function getMinimumBookingDate(config: DynamicConfig | null): string | null {
  return config?.clinic_info?.data_minima_agendamento || null;
}

/**
 * Retorna data mínima em formato de exibição (DD/MM/YYYY) ou texto genérico
 */
export function getMinDateDisplayText(config: DynamicConfig | null): string {
  const minDate = getMinimumBookingDate(config);
  if (!minDate) return 'a data mais próxima disponível';
  const [ano, mes, dia] = minDate.split('-');
  return `${dia}/${mes}/${ano}`;
}

/**
 * Retorna telefone da clínica (dinâmico ou fallback)
 */
export function getClinicPhone(config: DynamicConfig | null): string {
  return config?.clinic_info?.telefone || FALLBACK_PHONE;
}

/**
 * Retorna dias de busca inicial (dinâmico ou fallback)
 */
export function getDiasBuscaInicial(config: DynamicConfig | null): number {
  return config?.clinic_info?.dias_busca_inicial || FALLBACK_DIAS_BUSCA_INICIAL;
}

/**
 * Retorna dias de busca expandida (dinâmico ou fallback)
 */
export function getDiasBuscaExpandida(config: DynamicConfig | null): number {
  return config?.clinic_info?.dias_busca_expandida || FALLBACK_DIAS_BUSCA_EXPANDIDA;
}

/**
 * Retorna regras de negócio do médico (dinâmica ou hardcoded)
 */
export function getMedicoRules(config: DynamicConfig | null, medicoId: string, hardcodedRules: any): any {
  // 1. Tentar config dinâmica primeiro
  const dynamicRule = config?.business_rules?.[medicoId]?.config;
  if (dynamicRule) {
    console.log(`📋 [RULES] Usando regras DINÂMICAS para médico ${medicoId}`);
    return dynamicRule;
  }

  // 2. Fallback para hardcoded
  if (hardcodedRules) {
    console.log(`📋 [RULES] Usando regras HARDCODED para médico ${medicoId}`);
  }
  return hardcodedRules;
}

/**
 * Busca mensagem personalizada do banco de dados
 * @param tipo - Tipo da mensagem (bloqueio, confirmacao, sem_vaga, etc)
 * @param medicoId - ID do médico (opcional, para mensagens específicas)
 * @returns Mensagem personalizada ou null
 */
export function getMensagemPersonalizada(
  config: DynamicConfig | null,
  tipo: string,
  medicoId?: string
): string | null {
  if (!config?.mensagens) {
    return null;
  }

  // Mensagens podem ser array ou objeto (da RPC)
  const mensagensArray = Array.isArray(config.mensagens)
    ? config.mensagens
    : Object.values(config.mensagens);

  if (mensagensArray.length === 0) {
    return null;
  }

  // 1. Buscar mensagem específica do médico
  if (medicoId) {
    const msgMedico = mensagensArray.find(
      m => m.tipo === tipo && m.medico_id === medicoId
    );
    if (msgMedico) {
      console.log(`📝 [MSG] Usando mensagem personalizada do médico para tipo "${tipo}"`);
      return msgMedico.mensagem;
    }
  }

  // 2. Buscar mensagem global (medico_id = null)
  const msgGlobal = mensagensArray.find(
    m => m.tipo === tipo && !m.medico_id
  );
  if (msgGlobal) {
    console.log(`📝 [MSG] Usando mensagem global para tipo "${tipo}"`);
    return msgGlobal.mensagem;
  }

  return null;
}

/**
 * Gera mensagem de bloqueio de migração personalizada por médico
 * ATUALIZADO: Agora busca mensagens dinâmicas do banco primeiro
 * @param config - Configuração dinâmica (pode ser null)
 * @param medicoId - ID do médico (para mensagens específicas)
 * @param medicoNome - Nome do médico (para fallback hardcoded)
 * @returns Mensagem personalizada ou genérica
 */
export function getMigrationBlockMessage(
  config: DynamicConfig | null,
  medicoId?: string,
  medicoNome?: string
): string {
  // 1. TENTAR MENSAGEM PERSONALIZADA DO BANCO
  const msgPersonalizada = getMensagemPersonalizada(config, 'bloqueio_agenda', medicoId);
  if (msgPersonalizada) {
    return msgPersonalizada;
  }

  // 2. TENTAR MENSAGEM PADRÃO DA CLÍNICA DO BANCO
  if (config?.clinic_info?.mensagem_bloqueio_padrao) {
    return config.clinic_info.mensagem_bloqueio_padrao;
  }

  // 3. FALLBACK HARDCODED POR MÉDICO
  const nomeNormalizado = medicoNome
    ?.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Remove acentos
    .trim() || '';

  // Detectar se é Dr. Marcelo (várias variações possíveis)
  const isDrMarcelo =
    nomeNormalizado.includes('marcelo') ||
    nomeNormalizado.includes('dr. marcelo') ||
    nomeNormalizado.includes('dr marcelo');

  if (isDrMarcelo) {
    return `Para tentar encaixe antes é apenas com a secretária Jeniffe ou Luh no WhatsApp: 87981126744`;
  }

  // Detectar se é Dra. Adriana (várias variações possíveis)
  const isDraAdriana =
    nomeNormalizado.includes('adriana') ||
    nomeNormalizado.includes('adriana carla') ||
    nomeNormalizado.includes('dra. adriana') ||
    nomeNormalizado.includes('dra adriana');

  if (isDraAdriana) {
    const phone = getClinicPhone(config);
    return `O(a) paciente pode tentar um encaixe com a Dra. Adriana por ligação normal nesse mesmo número ${phone} (não atendemos ligação via whatsapp), de segunda a sexta-feira, às 10:00h, ou nas terças e quartas-feiras, às 14:30h`;
  }

  // Mensagem genérica para outros médicos
  const phone = getClinicPhone(config);
  const minDateText = getMinDateDisplayText(config);
  return `Agendamentos disponíveis a partir de ${minDateText}. Para datas anteriores, entre em contato pelo telefone: ${phone}`;
}
