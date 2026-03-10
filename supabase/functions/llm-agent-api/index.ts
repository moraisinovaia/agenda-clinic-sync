import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// v3.2.0 - Sistema Dinâmico com Logging Estruturado
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

const API_VERSION = '3.2.0';

// ============= SISTEMA DE LOGGING ESTRUTURADO =============

interface StructuredLog {
  timestamp: string;
  request_id: string;
  cliente_id: string;
  action: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  phase: 'request' | 'processing' | 'response';
  duration_ms?: number;
  success?: boolean;
  error_code?: string;
  metadata?: Record<string, any>;
}

// Métricas agregadas em memória (reset a cada cold start)
const METRICS = {
  start_time: Date.now(),
  total_requests: 0,
  success_count: 0,
  error_count: 0,
  total_duration_ms: 0,
  by_action: new Map<string, { count: number; total_ms: number; errors: number }>()
};

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function structuredLog(log: StructuredLog): void {
  console.log(JSON.stringify(log));
}

function updateMetrics(action: string, durationMs: number, success: boolean): void {
  METRICS.total_requests++;
  METRICS.total_duration_ms += durationMs;
  if (success) {
    METRICS.success_count++;
  } else {
    METRICS.error_count++;
  }
  
  const actionMetrics = METRICS.by_action.get(action) || { count: 0, total_ms: 0, errors: 0 };
  actionMetrics.count++;
  actionMetrics.total_ms += durationMs;
  if (!success) actionMetrics.errors++;
  METRICS.by_action.set(action, actionMetrics);
}

async function withLogging<T>(
  handlerName: string,
  clienteId: string,
  requestId: string,
  body: any,
  handler: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  
  // Log de entrada
  structuredLog({
    timestamp: new Date().toISOString(),
    request_id: requestId,
    cliente_id: clienteId,
    action: handlerName,
    level: 'info',
    phase: 'request',
    metadata: {
      body_keys: Object.keys(body || {}),
      body_size: JSON.stringify(body || {}).length
    }
  });

  try {
    const result = await handler();
    const duration = Math.round(performance.now() - startTime);
    
    // Atualizar métricas
    updateMetrics(handlerName, duration, true);
    
    // Log de saída (sucesso)
    structuredLog({
      timestamp: new Date().toISOString(),
      request_id: requestId,
      cliente_id: clienteId,
      action: handlerName,
      level: 'info',
      phase: 'response',
      duration_ms: duration,
      success: true
    });
    
    return result;
  } catch (error: any) {
    const duration = Math.round(performance.now() - startTime);
    
    // Atualizar métricas
    updateMetrics(handlerName, duration, false);
    
    // Log de saída (erro)
    structuredLog({
      timestamp: new Date().toISOString(),
      request_id: requestId,
      cliente_id: clienteId,
      action: handlerName,
      level: 'error',
      phase: 'response',
      duration_ms: duration,
      success: false,
      error_code: error?.code || 'UNKNOWN_ERROR',
      metadata: {
        error_message: error?.message,
        error_stack: error?.stack?.substring(0, 500)
      }
    });
    
    throw error;
  }
}

// ============= FUNÇÃO: BUSCAR AGENDA DEDICADA =============
/**
 * Busca agenda dedicada (virtual) para um serviço específico
 * Padrão de nome: "[Serviço] - [Nome do Médico]" ou "[Serviço] - Dr. [Nome]"
 * Ex: "Teste Ergométrico - Dr. Marcelo" para serviço "Teste Ergométrico" do Dr. Marcelo
 * 
 * Casos suportados:
 * - "Teste Ergométrico" + "Dr. Marcelo D'Carli" → "Teste Ergométrico - Dr. Marcelo"
 * - "MAPA 24H" + "Dr. Marcelo D'Carli" → "MAPA - Dr. Marcelo"
 */
async function buscarAgendaDedicada(
  supabase: any,
  clienteId: string,
  medicoNome: string,
  servicoNome: string
): Promise<{ id: string; nome: string } | null> {
  
  try {
    // Extrair nome curto do médico (ex: "Dr. Marcelo D'Carli" → "Marcelo")
    const partesNome = medicoNome.split(/[\s.]+/).filter(p => 
      p.length > 2 && !['dra', 'dr', 'dro', 'de', 'da', 'do', 'dos', 'das'].includes(p.toLowerCase())
    );
    const nomeChave = partesNome[0] || medicoNome;
    
    // Extrair palavra-chave do serviço (primeira palavra significativa)
    const servicoPalavras = servicoNome.split(/[\s-]+/).filter(p => p.length > 2);
    const servicoChave = servicoPalavras[0] || servicoNome;
    
    console.log(`🔍 [AGENDA_DEDICADA] Buscando agenda para serviço="${servicoChave}" + médico="${nomeChave}"`);
    
    // Buscar agenda com padrão "[Serviço]%[Médico]"
    const { data: agendas, error } = await supabase
      .from('medicos')
      .select('id, nome')
      .eq('cliente_id', clienteId)
      .eq('ativo', true)
      .ilike('nome', `%${servicoChave}%${nomeChave}%`);
      
    if (error) {
      console.error(`❌ [AGENDA_DEDICADA] Erro na busca:`, error);
      return null;
    }
    
    if (!agendas || agendas.length === 0) {
      console.log(`📋 [AGENDA_DEDICADA] Sem agenda dedicada para "${servicoNome}" + "${medicoNome}"`);
      return null;
    }
    
    // Se encontrou múltiplas, preferir a que tem nome mais específico
    const agendaSelecionada = agendas.sort((a: any, b: any) => {
      // Preferir a que contém mais do nome do serviço
      const aMatch = a.nome.toLowerCase().includes(servicoNome.toLowerCase()) ? 2 : 1;
      const bMatch = b.nome.toLowerCase().includes(servicoNome.toLowerCase()) ? 2 : 1;
      return bMatch - aMatch;
    })[0];
    
    console.log(`✅ [AGENDA_DEDICADA] Agenda dedicada encontrada: "${agendaSelecionada.nome}" (ID: ${agendaSelecionada.id})`);
    return agendaSelecionada;
    
  } catch (e) {
    console.error(`❌ [AGENDA_DEDICADA] Erro inesperado:`, e);
    return null;
  }
}

// ============= SISTEMA DE CACHE E CONFIGURAÇÃO DINÂMICA =============

interface DynamicConfig {
  clinic_info: {
    nome_clinica: string;
    telefone: string;
    whatsapp: string;
    endereco: string;
    data_minima_agendamento: string;
    dias_busca_inicial: number;
    dias_busca_expandida: number;
    mensagem_bloqueio_padrao: string;
  } | null;
  business_rules: Record<string, {
    medico_id: string;
    medico_nome: string;
    config: any;
  }>;
  mensagens: Record<string, {
    id: string;
    tipo: string;
    medico_id: string | null;
    mensagem: string;
    ativo: boolean;
  }> | Array<{
    id: string;
    tipo: string;
    medico_id: string | null;
    mensagem: string;
  }>;
  loadedAt: number;
}

interface ConfigCache {
  data: DynamicConfig;
  clienteId: string;
}

const CONFIG_CACHE: Map<string, ConfigCache> = new Map();
const CACHE_TTL_MS = 1 * 60 * 1000; // 1 minuto - alterações aplicam em no máximo 60 segundos

function isCacheValid(clienteId: string): boolean {
  const cached = CONFIG_CACHE.get(clienteId);
  if (!cached) return false;
  return Date.now() - cached.data.loadedAt < CACHE_TTL_MS;
}

/**
 * Carrega configuração dinâmica do banco de dados via RPC
 * Suporta dois modos:
 * - config_id: Carrega config específica (usado por proxies como Orion)
 * - cliente_id: Comportamento legado (primeira config ativa do cliente)
 * Retorna null se falhar (fallback para valores hardcoded)
 */
async function loadDynamicConfig(supabase: any, clienteId: string, configId?: string): Promise<DynamicConfig | null> {
  // Usar config_id como chave de cache se fornecido, senão cliente_id
  const cacheKey = configId || clienteId;
  
  // Verificar cache primeiro
  if (isCacheValid(cacheKey)) {
    console.log('📦 [CACHE] Usando configuração do cache');
    return CONFIG_CACHE.get(cacheKey)!.data;
  }
  
  try {
    console.log(`🔄 [CONFIG] Carregando configuração dinâmica...`);
    console.log(`   → config_id: ${configId || 'N/A'}`);
    console.log(`   → cliente_id: ${clienteId}`);
    
    // Carregar do banco via RPC (suporta p_config_id e p_cliente_id)
    const rpcParams: any = {};
    if (configId) {
      rpcParams.p_config_id = configId;
    } else {
      rpcParams.p_cliente_id = clienteId;
    }
    
    const { data, error } = await supabase.rpc('load_llm_config_for_clinic', rpcParams);
    
    if (error) {
      console.warn('⚠️ [CONFIG] Erro ao carregar config do banco:', error.message);
      return null;
    }
    
    // RPC retorna diretamente {clinic_info, business_rules, mensagens, loaded_at, config_id_used}
    // Verificar se há dados válidos (clinic_info ou business_rules presentes)
    if (!data || (!data.clinic_info && Object.keys(data.business_rules || {}).length === 0)) {
      console.warn('⚠️ [CONFIG] RPC não retornou dados válidos:', JSON.stringify(data));
      return null;
    }
    
    // Transformar business_rules para objeto indexado por medico_id (suporta array ou objeto)
    let businessRulesMap: Record<string, any> = {};
    if (data.business_rules) {
      if (Array.isArray(data.business_rules)) {
        // Formato array (compatibilidade)
        for (const rule of data.business_rules) {
          businessRulesMap[rule.medico_id] = rule;
        }
      } else if (typeof data.business_rules === 'object') {
        // Formato objeto indexado por medico_id (formato atual da RPC)
        businessRulesMap = data.business_rules;
      }
    }
    console.log(`📋 [CONFIG] business_rules carregadas: ${Object.keys(businessRulesMap).length} médicos`);
    
    const dynamicConfig: DynamicConfig = {
      clinic_info: data.clinic_info || null,
      business_rules: businessRulesMap,
      mensagens: data.mensagens || [],
      loadedAt: Date.now()
    };
    
    // Atualizar cache usando a chave correta
    CONFIG_CACHE.set(cacheKey, {
      data: dynamicConfig,
      clienteId: cacheKey
    });
    
    console.log(`✅ [CONFIG] Configuração carregada do banco:`, {
      config_id_used: data.config_id_used,
      tem_clinic_info: !!dynamicConfig.clinic_info,
      nome_clinica: dynamicConfig.clinic_info?.nome_clinica || 'N/A',
      total_business_rules: Object.keys(dynamicConfig.business_rules).length,
      total_mensagens: Object.keys(dynamicConfig.mensagens).length,
      data_minima: dynamicConfig.clinic_info?.data_minima_agendamento || 'N/A'
    });
    
    return dynamicConfig;
    
  } catch (err: any) {
    console.error('❌ [CONFIG] Erro crítico ao carregar config:', err.message);
    return null;
  }
}

// ============= FUNÇÕES HELPER PARA VALORES DINÂMICOS =============

/**
 * Normaliza um objeto de período para ter campos compatíveis com código legado
 * Suporta tanto formato antigo (inicio/fim) quanto novo (contagem_inicio/fim, horario_inicio/fim)
 * @param periodo - Objeto de configuração do período (manha/tarde/noite)
 * @returns Período normalizado com campos 'inicio' e 'fim' sempre presentes
 */
function normalizarPeriodo(periodo: any): any {
  if (!periodo) return periodo;
  
  // Se já tem inicio/fim, retornar como está (formato legado)
  if (periodo.inicio && periodo.fim) {
    return periodo;
  }
  
  // Normalizar para formato legado: usar contagem_inicio/fim ou horario_inicio/fim
  const inicio = periodo.contagem_inicio || periodo.horario_inicio || periodo.inicio;
  const fim = periodo.contagem_fim || periodo.horario_fim || periodo.fim;
  
  return {
    ...periodo,
    inicio: inicio,
    fim: fim,
    // Manter campos originais também
    contagem_inicio: periodo.contagem_inicio,
    contagem_fim: periodo.contagem_fim,
    horario_inicio: periodo.horario_inicio,
    horario_fim: periodo.horario_fim,
    atendimento_inicio: periodo.atendimento_inicio
  };
}

/**
 * Normaliza todos os períodos de um serviço
 * @param servico - Configuração do serviço com periodos
 * @returns Serviço com períodos normalizados
 */
function normalizarServicoPeriodos(servico: any): any {
  if (!servico || !servico.periodos) return servico;
  
  const periodosNormalizados: any = {};
  
  for (const [nomePeriodo, configPeriodo] of Object.entries(servico.periodos)) {
    periodosNormalizados[nomePeriodo] = normalizarPeriodo(configPeriodo);
  }
  
  return {
    ...servico,
    periodos: periodosNormalizados
  };
}

// ============= SISTEMA DE LIMITES COMPARTILHADOS E SUBLIMITES =============

interface LimiteCompartilhadoResult {
  permitido: boolean;
  erro_codigo?: 'LIMITE_POOL_ATINGIDO' | 'SUBLIMITE_PROPRIO_ATINGIDO';
  mensagem?: string;
  detalhes?: {
    pool_nome?: string;
    pool_limite?: number;
    pool_ocupado?: number;
    sublimite?: number;
    sublimite_ocupado?: number;
    servicos_pool?: string[];
  };
}

/**
 * Encontra o pool (período) que contém um determinado serviço para um dia específico
 * @param periodos - Configuração de períodos do médico
 * @param servicoKey - Chave do serviço (ex: 'ligadura_hemorroidas')
 * @param diaSemana - Dia da semana (0=dom, 1=seg, ..., 6=sab)
 * @returns Nome do pool e sua configuração, ou null se não encontrado
 */
function encontrarPoolParaServico(
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
async function verificarLimitesCompartilhados(
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
async function calcularVagasDisponiveisComLimites(
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

// 🚨 VALORES HARDCODED (fallback quando banco não disponível)
const FALLBACK_PHONE = ''; // Vazio para forçar uso de mensagem genérica
const FALLBACK_DIAS_BUSCA_INICIAL = 14;
const FALLBACK_DIAS_BUSCA_EXPANDIDA = 45;

/**
 * Retorna data mínima de agendamento (null = sem restrição)
 */
function getMinimumBookingDate(config: DynamicConfig | null): string | null {
  return config?.clinic_info?.data_minima_agendamento || null;
}

/**
 * Retorna telefone da clínica (dinâmico ou fallback)
 */
function getClinicPhone(config: DynamicConfig | null): string {
  return config?.clinic_info?.telefone || FALLBACK_PHONE;
}

/**
 * Retorna dias de busca inicial (dinâmico ou fallback)
 */
function getDiasBuscaInicial(config: DynamicConfig | null): number {
  return config?.clinic_info?.dias_busca_inicial || FALLBACK_DIAS_BUSCA_INICIAL;
}

/**
 * Retorna dias de busca expandida (dinâmico ou fallback)
 */
function getDiasBuscaExpandida(config: DynamicConfig | null): number {
  return config?.clinic_info?.dias_busca_expandida || FALLBACK_DIAS_BUSCA_EXPANDIDA;
}

/**
 * Retorna regras de negócio do médico (dinâmica ou hardcoded)
 */
function getMedicoRules(config: DynamicConfig | null, medicoId: string, hardcodedRules: any): any {
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
function getMensagemPersonalizada(
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
function getMigrationBlockMessage(
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
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
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

// ============= TIPO DE AGENDAMENTO EFETIVO =============
// Tipos possíveis: 'ordem_chegada', 'hora_marcada', 'estimativa_horario'
const TIPO_ORDEM_CHEGADA = 'ordem_chegada';
const TIPO_HORA_MARCADA = 'hora_marcada';
const TIPO_ESTIMATIVA_HORARIO = 'estimativa_horario';

/**
 * Determina o tipo de agendamento efetivo para um serviço
 * Considera herança do médico quando tipo = 'herdar' ou não definido
 * 
 * @param servicoConfig - Configuração do serviço específico
 * @param medicoConfig - Configuração geral do médico (regras)
 * @returns 'ordem_chegada' | 'hora_marcada' | 'estimativa_horario'
 */
function getTipoAgendamentoEfetivo(
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
function isEstimativaHorario(tipo: string): boolean {
  return tipo === TIPO_ESTIMATIVA_HORARIO;
}

/**
 * Verifica se o tipo de agendamento é hora marcada (exato)
 */
function isHoraMarcada(tipo: string): boolean {
  return tipo === TIPO_HORA_MARCADA;
}

/**
 * Verifica se o tipo de agendamento é ordem de chegada
 */
function isOrdemChegada(tipo: string): boolean {
  return tipo === TIPO_ORDEM_CHEGADA;
}

/**
 * Obtém o intervalo de minutos apropriado para o tipo de agendamento
 * - hora_marcada: usa intervalo_pacientes (padrão 30)
 * - estimativa_horario: usa intervalo_estimado (padrão 30)
 * - ordem_chegada: usa 1 minuto (para alocação sequencial)
 */
function getIntervaloMinutos(
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
function getMensagemEstimativa(servicoConfig: any, periodoConfig: any): string {
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
function formatarHorarioParaExibicao(
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
function getDataHoraAtualBrasil() {
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

// Manter compatibilidade - retorna apenas a data
function getDataAtualBrasil(): string {
  return getDataHoraAtualBrasil().data;
}

/**
 * 🚫 VALIDAÇÃO DE DATA/HORA FUTURA
 * Valida se a data/hora do agendamento é no futuro (timezone São Paulo)
 * @param dataAgendamento - Data no formato YYYY-MM-DD
 * @param horaAgendamento - Hora no formato HH:MM ou HH:MM:SS (opcional)
 * @returns { valido: boolean, erro?: string, dataMinima?: string, horaMinima?: string }
 */
function validarDataHoraFutura(
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
function classificarPeriodoAgendamento(
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
async function buscarProximasDatasDisponiveis(
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
const BUSINESS_RULES = {
  medicos: {} as Record<string, any>
};

/**
 * Formata data em português por extenso (ex: "06/02/2026")
 */
function formatarDataPorExtenso(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

/**
 * Monta mensagem contextual de consulta com informações do período e pagamento
 */
function montarMensagemConsulta(
  agendamento: any,
  regras: any,
  periodoConfig: any,
  isOrdemChegada: boolean
): string {
  const dataFormatada = formatarDataPorExtenso(agendamento.data_agendamento);
  const periodo = periodoConfig.distribuicao_fichas || 
                  `${periodoConfig.inicio} às ${periodoConfig.fim}`;
  
  let mensagem = `O(a) paciente ${agendamento.paciente_nome} tem uma consulta agendada para o dia ${dataFormatada}`;
  
  if (isOrdemChegada) {
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
function formatarConsultaComContexto(agendamento: any, config: DynamicConfig | null): any {
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
function calcularIdade(dataNascimento: string): number {
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
async function buscarProximoHorarioLivre(
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

// Função auxiliar para obter dia da semana (0=dom, 1=seg, ...)
// ✅ CORRIGIDO: Forçar interpretação local da data (evitar deslocamento UTC)
function getDiaSemana(data: string): number {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(ano, mes - 1, dia).getDay(); // Mês é 0-indexed
}

// ============= FUNÇÕES DE NORMALIZAÇÃO DE DADOS =============

/**
 * Normaliza data de nascimento de vários formatos para YYYY-MM-DD
 * Aceita: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, YYYY/MM/DD
 */
function normalizarDataNascimento(data: string | null | undefined): string | null {
  if (!data) return null;
  
  const limpo = data.trim();
  
  // Já está no formato correto YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpo)) {
    return limpo;
  }
  
  // Formato DD/MM/YYYY ou DD-MM-YYYY
  if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(limpo)) {
    const [dia, mes, ano] = limpo.split(/[\/\-]/);
    return `${ano}-${mes}-${dia}`;
  }
  
  // Formato YYYY/MM/DD
  if (/^\d{4}[\/]\d{2}[\/]\d{2}$/.test(limpo)) {
    return limpo.replace(/\//g, '-');
  }
  
  console.warn(`⚠️ Formato de data_nascimento não reconhecido: "${data}"`);
  return null;
}

/**
 * Normaliza número de telefone/celular
 * Remove todos os caracteres não numéricos
 * Aceita: (87) 9 9123-4567, 87991234567, +55 87 99123-4567
 */
function normalizarTelefone(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  
  // Remover tudo que não é número
  const apenasNumeros = telefone.replace(/\D/g, '');
  
  // Remover código do país (+55) se presente
  if (apenasNumeros.startsWith('55') && apenasNumeros.length > 11) {
    return apenasNumeros.substring(2);
  }
  
  return apenasNumeros;
}

/**
 * Normaliza nome do paciente
 * Remove espaços extras e capitaliza corretamente
 */
function normalizarNome(nome: string | null | undefined): string | null {
  if (!nome) return null;
  
  return nome
    .trim()
    .replace(/\s+/g, ' ') // Remove espaços duplicados
    .toUpperCase();
}

/**
 * 🛡️ Sanitiza valores inválidos vindos do N8N/LLM
 * Converte: "indefinido", "undefined", "null", "", "None" → undefined
 * Também trata textos conversacionais como "próximas datas disponíveis" → undefined
 */
function sanitizarCampoOpcional(valor: any): any {
  if (valor === null || valor === undefined) return undefined;
  
  if (typeof valor === 'string') {
    const valorTrim = valor.trim().toLowerCase();
    
    // Lista de valores inválidos comuns
    const valoresInvalidos = [
      'indefinido', 'undefined', 'null', 'none', 
      'n/a', 'na', '', 'empty'
    ];
    
    // 🆕 Padrões de texto conversacional que indicam "buscar datas automaticamente"
    const padroesConversacionais = [
      'próximas datas',
      'proximas datas',
      'datas disponíveis',
      'datas disponiveis',
      'qualquer data',
      'qualquer dia',
      'primeiro horário',
      'primeiro horario',
      'próximo horário',
      'proximo horario',
      'mais próxima',
      'mais proxima',
      'próxima data',
      'proxima data',
      'próximo disponível',
      'proximo disponivel',
      'qualquer horário',
      'qualquer horario',
      'o mais rápido',
      'o mais rapido',
      'mais cedo possível',
      'mais cedo possivel'
    ];
    
    if (valoresInvalidos.includes(valorTrim)) {
      console.log(`🧹 Campo com valor inválido "${valor}" convertido para undefined`);
      return undefined;
    }
    
    // 🆕 Verificar se contém padrão conversacional
    for (const padrao of padroesConversacionais) {
      if (valorTrim.includes(padrao)) {
        console.log(`🧹 Campo com texto conversacional "${valor}" convertido para undefined (trigger: "${padrao}")`);
        return undefined;
      }
    }
  }
  
  return valor;
}

// Função para mapear dados flexivelmente
function mapSchedulingData(body: any) {
  const mapped = {
    // Nome do paciente - aceitar diferentes formatos e normalizar
    paciente_nome: normalizarNome(
      body.paciente_nome || body.nome_paciente || body.nome_completo || body.patient_name
    ),
    
    // Data de nascimento - aceitar diferentes formatos e normalizar
    data_nascimento: normalizarDataNascimento(
      body.data_nascimento || body.paciente_nascimento || body.birth_date || body.nascimento
    ),
    
    // Convênio
    convenio: body.convenio || body.insurance || body.plano_saude,
    
    // Telefones - normalizar
    telefone: normalizarTelefone(body.telefone || body.phone || body.telefone_fixo),
    celular: normalizarTelefone(body.celular || body.mobile || body.whatsapp || body.telefone_celular),
    
    // Médico - aceitar ID ou nome
    medico_nome: body.medico_nome || body.doctor_name || body.nome_medico,
    medico_id: body.medico_id || body.doctor_id,
    
    // Atendimento
    atendimento_nome: body.atendimento_nome || body.tipo_consulta || body.service_name || body.procedimento,
    
    // Data e hora da consulta - aceitar diferentes formatos
    data_consulta: body.data_consulta || body.data_agendamento || body.appointment_date || body.data,
    hora_consulta: body.hora_consulta || body.hora_agendamento || body.appointment_time || body.hora,
    
    // Observações
    observacoes: body.observacoes || body.notes || body.comments || body.obs
  };
  
  // Log para debug (sem dados sensíveis completos)
  console.log('📝 Dados normalizados:', {
    paciente_nome: mapped.paciente_nome ? '✓' : '✗',
    data_nascimento: mapped.data_nascimento,
    celular: mapped.celular ? `${mapped.celular.substring(0, 4)}****` : '✗',
    telefone: mapped.telefone ? `${mapped.telefone.substring(0, 4)}****` : '✗',
  });
  
  return mapped;
}

serve(async (req) => {
  const requestId = generateRequestId();
  const apiStartTime = performance.now();
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validar API Key
  const apiKey = req.headers.get('x-api-key');
  const expectedApiKey = Deno.env.get('N8N_API_KEY');
  if (!apiKey || apiKey !== expectedApiKey) {
    console.error('❌ Unauthorized: Invalid or missing API key');
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Invalid API Key' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const method = req.method;
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Log inicial estruturado
    structuredLog({
      timestamp: new Date().toISOString(),
      request_id: requestId,
      cliente_id: 'pending',
      action: 'api_call',
      level: 'info',
      phase: 'request',
      metadata: {
        version: API_VERSION,
        method,
        path: url.pathname,
        uptime_ms: Date.now() - METRICS.start_time,
        total_requests_so_far: METRICS.total_requests
      }
    });
    
    console.log(`🤖 LLM Agent API v${API_VERSION} [${requestId}] ${method} ${url.pathname}`);

    if (method === 'POST') {
      let body = await req.json();
      
      // 🔍 DEBUG: Mostrar exatamente o que foi recebido
      console.log('📥 [DEBUG] Body recebido (raw):', JSON.stringify(body));
      console.log('📥 [DEBUG] Tipo do body:', typeof body);
      console.log('📥 [DEBUG] É array?:', Array.isArray(body));
      if (body) {
        console.log('📥 [DEBUG] Keys do body:', Object.keys(body));
      }
      
      // ✅ Normalizar body se for array (n8n às vezes envia [{...}] ao invés de {...})
      if (Array.isArray(body) && body.length > 0) {
        console.log('⚠️ Body recebido como array, extraindo primeiro elemento');
        body = body[0];
      }
      
      console.log('📤 [DEBUG] Body após normalização:', JSON.stringify(body));
      
      const rawAction = pathParts[1]; // /llm-agent-api/{action}
      
      // 🇧🇷 MAPEAMENTO PORTUGUÊS → INGLÊS (aceita ambos os formatos)
      const actionMap: Record<string, string> = {
        'agendar': 'schedule',
        'verificar-paciente': 'check-patient',
        'remarcar': 'reschedule',
        'cancelar': 'cancel',
        'confirmar': 'confirm',
        'disponibilidade': 'availability',
        'pesquisa-pacientes': 'patient-search',
        'lista-consultas': 'list-appointments',
        'lista-medicos': 'list-doctors',
        'info-clinica': 'clinic-info'
      };
      const action = actionMap[rawAction] || rawAction;
      
      if (actionMap[rawAction]) {
        console.log(`🔄 [I18N] Action mapeada: ${rawAction} → ${action}`);
      }

      // 🔑 MULTI-CLIENTE: Aceita config_id e cliente_id do body
      // config_id: Identifica configuração específica (usado por filiais como Orion)
      // cliente_id: Fallback para compatibilidade (busca primeira config ativa)
      const IPADO_CLIENT_ID = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';
      const CLIENTE_ID = body.cliente_id || IPADO_CLIENT_ID;
      const CONFIG_ID = body.config_id; // Se fornecido, usa config específica
      
      // Identificar origem da requisição
      const isProxy = !!body.cliente_id || !!body.config_id;
      
      console.log(`🏥 Cliente ID: ${CLIENTE_ID}${isProxy ? ' [via proxy]' : ''}`);
      if (CONFIG_ID) {
        console.log(`🔧 Config ID: ${CONFIG_ID} (filial específica)`);
      }

      // 🆕 CARREGAR CONFIGURAÇÃO DINÂMICA DO BANCO
      // Se config_id foi fornecido, carrega config específica (ex: Orion)
      // Senão, busca primeira config ativa do cliente_id
      const dynamicConfig = await loadDynamicConfig(supabase, CLIENTE_ID, CONFIG_ID);
      
      // Nome do cliente vem do banco (sem hardcodes)
      const clienteNome = dynamicConfig?.clinic_info?.nome_clinica || 'Cliente';
      
      if (dynamicConfig?.clinic_info) {
        console.log(`✅ Config carregada: ${clienteNome}`);
      } else {
        console.log(`⚠️ Sem configuração no banco para cliente ${CLIENTE_ID}`);
      }

      switch (action) {
        case 'schedule':
          return await withLogging('schedule', CLIENTE_ID, requestId, body,
            () => handleSchedule(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'check-patient':
          return await withLogging('check-patient', CLIENTE_ID, requestId, body,
            () => handleCheckPatient(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'reschedule':
          return await withLogging('reschedule', CLIENTE_ID, requestId, body,
            () => handleReschedule(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'cancel':
          return await withLogging('cancel', CLIENTE_ID, requestId, body,
            () => handleCancel(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'confirm':
          return await withLogging('confirm', CLIENTE_ID, requestId, body,
            () => handleConfirm(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'availability':
          return await withLogging('availability', CLIENTE_ID, requestId, body,
            () => handleAvailability(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'patient-search':
          return await withLogging('patient-search', CLIENTE_ID, requestId, body,
            () => handlePatientSearch(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'list-appointments':
          return await withLogging('list-appointments', CLIENTE_ID, requestId, body,
            () => handleListAppointments(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'list-doctors':
          return await withLogging('list-doctors', CLIENTE_ID, requestId, body,
            () => handleListDoctors(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'clinic-info':
          return await withLogging('clinic-info', CLIENTE_ID, requestId, body,
            () => handleClinicInfo(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'doctor-schedules':
        case 'horarios-medicos':
          return await withLogging('doctor-schedules', CLIENTE_ID, requestId, body,
            () => handleDoctorSchedules(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'consultar-fila':
          return await withLogging('consultar-fila', CLIENTE_ID, requestId, body,
            () => handleConsultarFila(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'adicionar-fila':
          return await withLogging('adicionar-fila', CLIENTE_ID, requestId, body,
            () => handleAdicionarFila(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'responder-fila':
          return await withLogging('responder-fila', CLIENTE_ID, requestId, body,
            () => handleResponderFila(supabase, body, CLIENTE_ID, dynamicConfig));
        default:
          structuredLog({
            timestamp: new Date().toISOString(),
            request_id: requestId,
            cliente_id: CLIENTE_ID,
            action: action || 'unknown',
            level: 'warn',
            phase: 'response',
            duration_ms: Math.round(performance.now() - apiStartTime),
            success: false,
            error_code: 'UNKNOWN_ACTION'
          });
          return errorResponse('Ação não reconhecida. Ações disponíveis: schedule, check-patient, reschedule, cancel, confirm, availability, patient-search, list-appointments, list-doctors, clinic-info, doctor-schedules, consultar-fila, adicionar-fila, responder-fila');
      }
    }

    return errorResponse('Método não permitido. Use POST.');

  } catch (error: any) {
    console.error('❌ Erro na LLM Agent API:', error);
    structuredLog({
      timestamp: new Date().toISOString(),
      request_id: requestId,
      cliente_id: 'unknown',
      action: 'api_error',
      level: 'error',
      phase: 'response',
      duration_ms: Math.round(performance.now() - apiStartTime),
      success: false,
      error_code: 'INTERNAL_ERROR',
      metadata: {
        error_message: error?.message,
        error_stack: error?.stack?.substring(0, 500)
      }
    });
    return errorResponse(`Erro interno: ${error?.message || 'Erro desconhecido'}`);
  }
})

// ============= FUZZY MATCHING DE NOMES DE MÉDICOS =============
const STOPWORDS_MEDICO = new Set(['dr', 'dra', 'de', 'da', 'do', 'dos', 'das', 'e', 'o', 'a']);

function normalizarTexto(texto: string): string {
  return texto.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,\-']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extrairPalavrasSignificativas(textoNormalizado: string): string[] {
  return textoNormalizado.split(' ').filter(p => p.length > 1 && !STOPWORDS_MEDICO.has(p));
}

function fuzzyMatchMedicos<T extends { nome: string }>(nomeInput: string, medicos: T[]): T[] {
  const inputNorm = normalizarTexto(nomeInput);
  
  // 1) Match exato por includes (lógica original)
  const exatos = medicos.filter(m => {
    const n = normalizarTexto(m.nome);
    return n.includes(inputNorm) || inputNorm.includes(n);
  });
  if (exatos.length > 0) return exatos;

  // 2) Fuzzy: score por palavras significativas em comum
  const palavrasInput = extrairPalavrasSignificativas(inputNorm);
  if (palavrasInput.length === 0) return [];

  const scored = medicos.map(m => {
    const palavrasMedico = extrairPalavrasSignificativas(normalizarTexto(m.nome));
    if (palavrasMedico.length === 0) return { medico: m, score: 0 };

    // Contar palavras do input que aparecem (parcial) em alguma palavra do médico e vice-versa
    let matchCount = 0;
    for (const pi of palavrasInput) {
      for (const pm of palavrasMedico) {
        if (pi.includes(pm) || pm.includes(pi)) { matchCount++; break; }
      }
    }
    const score = matchCount / Math.min(palavrasInput.length, palavrasMedico.length);
    return { medico: m, score };
  });

  const threshold = 0.5;
  const matches = scored
    .filter(s => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map(s => s.medico);

  if (matches.length > 0) {
    console.log(`🔍 Fuzzy match: "${nomeInput}" → "${matches[0].nome}" (${scored.find(s => s.medico === matches[0])?.score.toFixed(2)})`);
  }
  return matches;
}


/**
 * Formata convênio para o padrão do banco de dados (MAIÚSCULO)
 * Remove hífens/underscores e espaços extras
 * Exemplos:
 * - "unimed nacional" → "UNIMED NACIONAL"
 * - "UNIMED-REGIONAL" → "UNIMED REGIONAL"
 * - "unimed 40%" → "UNIMED 40%"
 * - "Particular" → "PARTICULAR"
 */
function formatarConvenioParaBanco(convenio: string): string {
  if (!convenio) return convenio;
  
  // Limpar e normalizar: remover hífens/underscores, espaços extras, converter para MAIÚSCULO
  const limpo = convenio
    .trim()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase(); // ✅ MAIÚSCULO para evitar problemas de case-sensitivity
  
  console.log(`📝 Convênio formatado: "${convenio}" → "${limpo}"`);
  return limpo;
}

// Agendar consulta
async function handleSchedule(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    console.log('📥 Dados recebidos na API:', JSON.stringify(body, null, 2));
    
    // 🛡️ SANITIZAÇÃO AUTOMÁTICA: Remover "=" do início dos valores (problema comum do N8N)
    const sanitizeValue = (value: any): any => {
      if (typeof value === 'string' && value.startsWith('=')) {
        const cleaned = value.substring(1);
        console.log(`🧹 Sanitizado: "${value}" → "${cleaned}"`);
        return cleaned;
      }
      return value;
    };
    
    // Sanitizar todos os campos do body antes do mapeamento
    const sanitizedBody = Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, sanitizeValue(value)])
    );
    
    // 🆕 Aplicar sanitização robusta em campos opcionais
    const robustSanitizedBody = {
      ...sanitizedBody,
      data_nascimento: sanitizarCampoOpcional(sanitizedBody.data_nascimento),
      telefone: sanitizarCampoOpcional(sanitizedBody.telefone),
      celular: sanitizarCampoOpcional(sanitizedBody.celular)
    };
    
    // Mapear dados flexivelmente (aceitar diferentes formatos)
    const mappedData = mapSchedulingData(robustSanitizedBody);
    console.log('🔄 Dados mapeados:', JSON.stringify(mappedData, null, 2));
    
    const { 
      paciente_nome, 
      data_nascimento, 
      convenio, 
      telefone, 
      celular, 
      medico_nome, 
      medico_id,
      atendimento_nome, 
      data_consulta, 
      hora_consulta, 
      observacoes 
    } = mappedData;

    // Validar campos obrigatórios
    if (!paciente_nome || !data_nascimento || !convenio || !celular || (!medico_nome && !medico_id) || !data_consulta || !hora_consulta) {
      const missingFields = [];
      if (!paciente_nome) missingFields.push('paciente_nome');
      if (!data_nascimento) missingFields.push('data_nascimento');
      if (!convenio) missingFields.push('convenio');
      if (!celular) missingFields.push('celular');
      if (!medico_nome && !medico_id) missingFields.push('medico_nome ou medico_id');
      if (!data_consulta) missingFields.push('data_consulta');
      if (!hora_consulta) missingFields.push('hora_consulta');
      
      return businessErrorResponse({
        codigo_erro: 'DADOS_INCOMPLETOS',
        mensagem_usuario: `❌ Faltam informações obrigatórias para o agendamento:\n\n${missingFields.map(f => `   • ${f}`).join('\n')}\n\n💡 Por favor, forneça todos os dados necessários.`,
        detalhes: {
          campos_faltando: missingFields
        }
      });
    }

    // 🚫 VALIDAR: Data/hora não pode ser no passado
    const validacaoDataSchedule = validarDataHoraFutura(data_consulta, hora_consulta);
    if (!validacaoDataSchedule.valido) {
      const { data: dataAtualBrasil } = getDataHoraAtualBrasil();
      
      if (validacaoDataSchedule.erro === 'DATA_PASSADA') {
        return businessErrorResponse({
          codigo_erro: 'DATA_PASSADA',
          mensagem_usuario: `❌ Não é possível agendar para ${formatarDataPorExtenso(data_consulta)} pois essa data já passou.\n\n📅 A data de hoje é ${formatarDataPorExtenso(dataAtualBrasil)}.\n\n💡 Por favor, escolha uma data a partir de hoje.`,
          detalhes: { 
            data_solicitada: data_consulta,
            data_atual: dataAtualBrasil
          }
        });
      }
      
      if (validacaoDataSchedule.erro === 'HORARIO_PASSADO') {
        return businessErrorResponse({
          codigo_erro: 'HORARIO_PASSADO',
          mensagem_usuario: `❌ Não é possível agendar para ${hora_consulta} hoje pois esse horário já passou ou está muito próximo.\n\n⏰ Horário mínimo para agendamento hoje: ${validacaoDataSchedule.horaMinima}\n\n💡 Escolha um horário posterior ou agende para outro dia.`,
          detalhes: { 
            data_solicitada: data_consulta,
            hora_solicitada: hora_consulta,
            hora_minima: validacaoDataSchedule.horaMinima
          }
        });
      }
    }

    // 🗓️ Calcular dia da semana (necessário para validações)
    const dataObj = new Date(data_consulta + 'T00:00:00');
    const diasSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const dia_semana = diasSemana[dataObj.getDay()];
    
    // Função simples para classificar período baseado na hora
    const classificarPeriodoSimples = (hora: string): string => {
      const [h] = hora.split(':').map(Number);
      return h < 12 ? 'manha' : 'tarde';
    };
    const periodo = classificarPeriodoSimples(hora_consulta);

    // Buscar médico por ID ou nome (COM filtro de cliente)
    let medico;
    console.log('🔍 Iniciando busca de médico...');
    if (medico_id) {
      console.log(`🔍 Buscando médico por ID: ${medico_id}`);
      const { data, error } = await supabase
        .from('medicos')
        .select('id, nome, ativo, crm, rqe')
        .eq('id', medico_id)
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .single();
      
      medico = data;
      if (error || !medico) {
        return businessErrorResponse({
          codigo_erro: 'MEDICO_NAO_ENCONTRADO',
          mensagem_usuario: `❌ Médico com ID "${medico_id}" não foi encontrado ou está inativo.\n\n💡 Verifique se o código do médico está correto ou entre em contato com a clínica.`,
          detalhes: { medico_id }
        });
      }
      console.log(`✅ Médico encontrado por ID: ${medico.nome}`);
      
      // 🆕 VERIFICAR AGENDA DEDICADA PARA O SERVIÇO (busca por ID)
      if (atendimento_nome) {
        const agendaDedicada = await buscarAgendaDedicada(supabase, clienteId, medico.nome, atendimento_nome);
        if (agendaDedicada) {
          console.log(`🔄 [SCHEDULE] Redirecionando para agenda dedicada "${agendaDedicada.nome}" (ID: ${agendaDedicada.id})`);
          medico = { id: agendaDedicada.id, nome: agendaDedicada.nome, ativo: true };
          console.log(`✅ [SCHEDULE] Agendamento será criado na agenda: ${medico.nome}`);
        }
      }
    } else {
      console.log(`🔍 Buscando médico por nome: ${medico_nome}`);
      
      // Buscar TODOS os médicos ativos do cliente (mesma lógica do handleAvailability)
      const { data: todosMedicos, error: medicosError } = await supabase
        .from('medicos')
        .select('id, nome, ativo, crm, rqe')
        .eq('cliente_id', clienteId)
        .eq('ativo', true);
      
      if (medicosError || !todosMedicos || todosMedicos.length === 0) {
        console.error(`❌ Erro ao buscar médicos:`, medicosError);
        return businessErrorResponse({
          codigo_erro: 'ERRO_BUSCA_MEDICOS',
          mensagem_usuario: '❌ Não foi possível buscar médicos disponíveis.',
          detalhes: { erro: medicosError?.message }
        });
      }
      
      console.log(`📋 Total de médicos ativos encontrados: ${todosMedicos.length}`);
      console.log(`📋 Médicos disponíveis: ${todosMedicos.map(m => m.nome).join(', ')}`);
      
      // Matching inteligente com fuzzy fallback
      console.log(`🔍 Buscando médico: "${medico_nome}"`);
      const medicosEncontrados = fuzzyMatchMedicos(medico_nome, todosMedicos);
      
      if (medicosEncontrados.length === 0) {
        console.log(`❌ Nenhum médico encontrado para: "${medico_nome}"`);
        const sugestoes = todosMedicos.map(m => m.nome).slice(0, 10);
        return businessErrorResponse({
          codigo_erro: 'MEDICO_NAO_ENCONTRADO',
          mensagem_usuario: `❌ Médico "${medico_nome}" não encontrado.\n\n✅ Médicos disponíveis:\n${sugestoes.map(m => `   • ${m}`).join('\n')}`,
          detalhes: { medico_solicitado: medico_nome, medicos_disponiveis: sugestoes }
        });
      }
      
      medico = medicosEncontrados[0];
      console.log(`✅ Médico encontrado por nome inteligente: "${medico_nome}" → "${medico.nome}" (ID: ${medico.id})`);
      
      // 🆕 VERIFICAR AGENDA DEDICADA PARA O SERVIÇO (busca por nome)
      if (atendimento_nome) {
        const agendaDedicada = await buscarAgendaDedicada(supabase, clienteId, medico.nome, atendimento_nome);
        if (agendaDedicada) {
          console.log(`🔄 [SCHEDULE] Redirecionando para agenda dedicada "${agendaDedicada.nome}" (ID: ${agendaDedicada.id})`);
          medico = { id: agendaDedicada.id, nome: agendaDedicada.nome, ativo: true };
          console.log(`✅ [SCHEDULE] Agendamento será criado na agenda: ${medico.nome}`);
        }
      }
    }

    console.log('🔍 Buscando regras de negócio...');
    // ===== VALIDAÇÕES DE REGRAS DE NEGÓCIO (APENAS PARA N8N) =====
    const regras = getMedicoRules(config, medico.id, BUSINESS_RULES.medicos[medico.id]);
    console.log(`📋 Regras encontradas para médico ID ${medico.id}: ${regras ? 'SIM' : 'NÃO'}`);
    
    if (regras) {
      console.log(`✅ Regras válidas para ${regras.nome}`);
      console.log(`📋 Tipo de regras.servicos: ${typeof regras.servicos}`);
      console.log(`📋 Regras.servicos é null/undefined: ${!regras.servicos}`);
      
      // Validar se regras.servicos existe e é um objeto
      if (!regras.servicos || typeof regras.servicos !== 'object') {
        console.error(`❌ ERRO: regras.servicos inválido para ${regras.nome}`);
        console.error(`📋 Estrutura de regras:`, JSON.stringify(regras, null, 2));
        // Não bloquear o agendamento, apenas pular validações
        console.log(`⚠️ Prosseguindo sem validações de serviço para ${medico.nome}`);
      } else {
        console.log(`✅ regras.servicos válido, contém ${Object.keys(regras.servicos).length} serviço(s)`);
        
        // 1. Validar idade mínima
        if (regras.idade_minima && regras.idade_minima > 0) {
          const idade = calcularIdade(data_nascimento);
          if (idade < regras.idade_minima) {
            // 🆕 Usar mensagem personalizada se configurada
            const mensagemIdadeMinima = regras.mensagem_idade_minima ||
              `❌ ${regras.nome} atende apenas pacientes com ${regras.idade_minima}+ anos.\n\n📋 Idade informada: ${idade} anos\n\n💡 Por favor, consulte outro profissional adequado para a faixa etária.`;
            
            console.log(`🚫 [IDADE] Paciente com ${idade} anos bloqueado (mínimo: ${regras.idade_minima})`);
            
            return businessErrorResponse({
              codigo_erro: 'IDADE_INCOMPATIVEL',
              mensagem_usuario: mensagemIdadeMinima,
              detalhes: {
                medico: regras.nome,
                idade_minima: regras.idade_minima,
                idade_paciente: idade
              }
            });
          }
          console.log(`✅ Validação de idade OK: ${idade} anos (mínimo: ${regras.idade_minima})`);
        }
        
        // 2. Validar serviço específico
        if (atendimento_nome) {
          try {
            // 🔧 CORREÇÃO: Normalizar nomes para matching correto
            // "Ligadura de Hemorroidas" → "ligadurahemorrodas" = "ligadura_hemorroidas"
            const normalizarNome = (texto: string): string => 
              texto.toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')  // Remove acentos
                .replace(/\b(de|da|do|das|dos)\b/g, '') // Remove preposições conectivas
                .replace(/[_\-\s]+/g, '')         // Remove underscores, hífens, espaços
                .replace(/oi/g, 'o')              // hemorroidas → hemorrodos (normaliza variações)
                .replace(/ai/g, 'a');             // variações comuns
            
            const atendimentoNorm = normalizarNome(atendimento_nome);
            const servicoChaves = Object.keys(regras.servicos);
            console.log(`🔍 [handleSchedule] Buscando serviço: "${atendimento_nome}" → normalizado: "${atendimentoNorm}"`);
            console.log(`🔍 [handleSchedule] Chaves normalizadas: [${servicoChaves.map(s => `${s}→${normalizarNome(s)}`).join(', ')}]`);
            
            const servicoKeyValidacao = Object.keys(regras.servicos).find(s => {
              const servicoNorm = normalizarNome(s);
              const match = servicoNorm.includes(atendimentoNorm) || 
                           atendimentoNorm.includes(servicoNorm) ||
                           servicoNorm === atendimentoNorm;
              if (match) {
                console.log(`✅ [handleSchedule] Match encontrado: "${s}" (${servicoNorm}) ← "${atendimento_nome}" (${atendimentoNorm})`);
              }
              return match;
            });
            
            if (servicoKeyValidacao) {
              const servicoLocal = regras.servicos[servicoKeyValidacao];
              console.log(`🔍 Validando serviço: ${servicoKeyValidacao}`);
              
              
              // 2.1 Verificar se permite agendamento online (multi-nível: serviço, raiz, config nested)
              const permiteOnline = 
                servicoLocal.permite_online || 
                servicoLocal.permite_agendamento_online ||
                regras?.permite_agendamento_online ||      // Nível raiz das regras (agendas dedicadas)
                (regras as any)?.config?.permite_agendamento_online;  // Fallback config nested
              if (!permiteOnline) {
                console.log(`❌ Serviço ${servicoKeyValidacao} não permite agendamento online`);
                return businessErrorResponse({
                  codigo_erro: 'SERVICO_NAO_DISPONIVEL_ONLINE',
                  mensagem_usuario: servicoLocal.mensagem || `❌ O serviço "${servicoKeyValidacao}" não pode ser agendado online.\n\n📞 Por favor, entre em contato com a clínica para agendar este procedimento.`,
                  detalhes: {
                    servico: servicoKeyValidacao,
                    medico: regras.nome
                  }
                });
              }
              
              // 🆕 2.1.1 VERIFICAR LIMITES COMPARTILHADOS E SUBLIMITES
              if (servicoLocal.compartilha_limite_com || servicoLocal.limite_proprio) {
                console.log(`🔐 Serviço "${servicoKeyValidacao}" tem limites especiais configurados`);
                
                const resultadoLimites = await verificarLimitesCompartilhados(
                  supabase,
                  clienteId,
                  medico.id,
                  data_consulta,
                  servicoKeyValidacao,
                  servicoLocal,
                  regras
                );
                
                if (!resultadoLimites.permitido) {
                  console.log(`❌ Limites compartilhados/sublimite bloquearam agendamento: ${resultadoLimites.erro_codigo}`);
                  
                  // Buscar próximas datas disponíveis para este serviço
                  const proximasDatasDisponiveis: Array<{data: string; dia_semana: string; vagas_disponiveis: number}> = [];
                  const diasSemanaArr = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                  
                  for (let dias = 1; dias <= 30; dias++) {
                    const dataFutura = new Date(data_consulta + 'T00:00:00');
                    dataFutura.setDate(dataFutura.getDate() + dias);
                    const dataFuturaStr = dataFutura.toISOString().split('T')[0];
                    const diaSemanaNum = dataFutura.getDay();
                    
                    // Pular finais de semana
                    if (diaSemanaNum === 0 || diaSemanaNum === 6) continue;
                    
                    // Verificar se o dia é permitido para o serviço
                    if (servicoLocal.dias && !servicoLocal.dias.includes(diaSemanaNum)) continue;
                    
                    // Verificar vagas disponíveis considerando limites
                    const vagasDisponiveis = await calcularVagasDisponiveisComLimites(
                      supabase,
                      clienteId,
                      medico.id,
                      dataFuturaStr,
                      servicoKeyValidacao,
                      servicoLocal,
                      regras
                    );
                    
                    if (vagasDisponiveis > 0) {
                      proximasDatasDisponiveis.push({
                        data: dataFuturaStr,
                        dia_semana: diasSemanaArr[diaSemanaNum],
                        vagas_disponiveis: vagasDisponiveis
                      });
                      
                      if (proximasDatasDisponiveis.length >= 5) break;
                    }
                  }
                  
                  let mensagemUsuario = `❌ ${resultadoLimites.mensagem}\n\n`;
                  
                  if (proximasDatasDisponiveis.length > 0) {
                    mensagemUsuario += `✅ Próximas datas disponíveis:\n\n`;
                    proximasDatasDisponiveis.forEach(d => {
                      mensagemUsuario += `📅 ${formatarDataPorExtenso(d.data)} (${d.dia_semana}) - ${d.vagas_disponiveis} vaga(s)\n`;
                    });
                    mensagemUsuario += `\n💡 Gostaria de agendar em uma destas datas?`;
                  } else {
                    mensagemUsuario += `⚠️ Não encontramos vagas nos próximos 30 dias.\n`;
                    mensagemUsuario += `📞 Por favor, entre em contato com a clínica para mais opções.`;
                  }
                  
                  return businessErrorResponse({
                    codigo_erro: resultadoLimites.erro_codigo || 'LIMITE_ATINGIDO',
                    mensagem_usuario: mensagemUsuario,
                    detalhes: {
                      ...resultadoLimites.detalhes,
                      medico: regras.nome,
                      servico: servicoKeyValidacao,
                      data_solicitada: data_consulta
                    },
                    sugestoes: proximasDatasDisponiveis.length > 0 ? {
                      proximas_datas: proximasDatasDisponiveis,
                      acao_sugerida: 'reagendar_data_alternativa'
                    } : null
                  });
                }
                
                console.log(`✅ Limites compartilhados/sublimite OK para "${servicoKeyValidacao}"`);
              }
              
              // 2.2 Verificar dias permitidos
              if (servicoLocal.dias_permitidos && dia_semana && !servicoLocal.dias_permitidos.includes(dia_semana)) {
                const diasPermitidos = servicoLocal.dias_permitidos.join(', ');
                console.log(`❌ ${regras.nome} não atende ${servicoKeyValidacao} às ${dia_semana}s`);
                return businessErrorResponse({
                  codigo_erro: 'DIA_NAO_PERMITIDO',
                  mensagem_usuario: `❌ ${regras.nome} não atende ${servicoKeyValidacao} no dia escolhido.\n\n✅ Dias disponíveis: ${diasPermitidos}\n\n💡 Escolha uma data em um dos dias disponíveis.`,
                  detalhes: {
                    medico: regras.nome,
                    servico: servicoKeyValidacao,
                    dia_solicitado: dia_semana,
                    dias_permitidos: servicoLocal.dias_permitidos
                  }
                });
              }
              
              // 2.3 Verificar períodos específicos por dia
              if (servicoLocal.periodos_por_dia && periodo && dia_semana) {
                const periodosPermitidos = servicoLocal.periodos_por_dia[dia_semana];
                if (periodosPermitidos && !periodosPermitidos.includes(periodo)) {
                  console.log(`❌ ${regras.nome} não atende ${servicoKeyValidacao} no período da ${periodo} às ${dia_semana}s`);
                  const periodoTexto = periodo === 'manha' ? 'Manhã' : periodo === 'tarde' ? 'Tarde' : 'Noite';
                  return businessErrorResponse({
                    codigo_erro: 'PERIODO_NAO_PERMITIDO',
                    mensagem_usuario: `❌ ${regras.nome} não atende ${servicoKeyValidacao} no período da ${periodoTexto} às ${dia_semana}s.\n\n✅ Períodos disponíveis neste dia: ${periodosPermitidos.map(p => p === 'manha' ? 'Manhã' : p === 'tarde' ? 'Tarde' : 'Noite').join(', ')}\n\n💡 Escolha um dos períodos disponíveis.`,
                    detalhes: {
                      medico: regras.nome,
                      servico: servicoKeyValidacao,
                      dia_semana: dia_semana,
                      periodo_solicitado: periodo,
                      periodos_disponiveis: periodosPermitidos
                    }
                  });
                }
                
                if (!periodosPermitidos && servicoLocal.periodos_por_dia) {
                  const diasDisponiveis = Object.keys(servicoLocal.periodos_por_dia);
                  const diasPermitidos = diasDisponiveis.join(', ');
                  console.log(`❌ ${regras.nome} não atende ${servicoKeyValidacao} às ${dia_semana}s no período da ${periodo}`);
                  const periodoTexto = periodo === 'manha' ? 'Manhã' : periodo === 'tarde' ? 'Tarde' : 'Noite';
                  return businessErrorResponse({
                    codigo_erro: 'DIA_PERIODO_NAO_PERMITIDO',
                    mensagem_usuario: `❌ ${regras.nome} não atende ${servicoKeyValidacao} no período da ${periodoTexto} no dia escolhido.\n\n✅ Dias disponíveis para este período: ${diasPermitidos}\n\n💡 Escolha uma data em um dos dias disponíveis.`,
                    detalhes: {
                      medico: regras.nome,
                      servico: servicoKeyValidacao,
                      dia_solicitado: dia_semana,
                      periodo: periodo,
                      dias_com_periodo: diasDisponiveis
                    }
                  });
                }
              }
              
              // 2.4 Verificar limite de vagas
              if (servicoLocal.periodos && periodo && data_consulta) {
                const configPeriodo = servicoLocal.periodos[periodo];
                if (configPeriodo && configPeriodo.limite) {
                  // 🆕 Usar contagem_inicio/contagem_fim se configurados, senão fallback
                  const inicioContagem = configPeriodo.contagem_inicio || configPeriodo.inicio;
                  const fimContagem = configPeriodo.contagem_fim || configPeriodo.fim;
                  console.log(`🔢 [CONTAGEM] Validação - exibição: ${configPeriodo.inicio}-${configPeriodo.fim}, contagem: ${inicioContagem}-${fimContagem}`);
                  
                   // ✅ Buscar TODOS os agendamentos ativos do período (sem filtro de created_at)
                   let query = supabase
                     .from('agendamentos')
                     .select('id, hora_agendamento, created_at')
                     .eq('medico_id', medico.id)
                     .eq('data_agendamento', data_consulta)
                     .eq('cliente_id', clienteId)
                     .is('excluido_em', null)
                     .is('cancelado_em', null)
                     .in('status', ['agendado', 'confirmado']);
                  
                  // 🆕 Filtrar por horário do período de CONTAGEM
                  if (inicioContagem && fimContagem) {
                    query = query
                      .gte('hora_agendamento', inicioContagem)
                      .lt('hora_agendamento', fimContagem);
                  }
                  
                  const { data: agendamentos, error: agendError } = await query;
                  
                  if (agendError) {
                    console.error('Erro ao verificar limite de vagas:', agendError);
                  } else {
                    const vagasOcupadas = agendamentos?.length || 0;
                    if (vagasOcupadas >= configPeriodo.limite) {
                      console.log(`❌ Limite atingido para ${servicoKeyValidacao}: ${vagasOcupadas}/${configPeriodo.limite}`);
                      
                      // 🆕 Buscar próximas datas com vagas disponíveis
                      let proximasDatasDisponiveis = [];
                      console.log(`🔍 Buscando datas alternativas para ${regras.nome} - ${servicoKeyValidacao}...`);
                      console.log(`📋 Limite de vagas: ${configPeriodo.limite}`);
                      console.log(`📋 Período: ${configPeriodo.periodo || 'não especificado'}`);
                      
                      try {
                        // Buscar próximas 60 datas com vagas
                        for (let dias = 1; dias <= 60; dias++) {
                          const dataFutura = new Date(data_consulta + 'T00:00:00');
                          dataFutura.setDate(dataFutura.getDate() + dias);
                          const dataFuturaStr = dataFutura.toISOString().split('T')[0];
                          
                          // Pular finais de semana
                          const diaSemana = dataFutura.getDay();
                          if (diaSemana === 0 || diaSemana === 6) {
                            console.log(`⏭️  Pulando ${dataFuturaStr} (final de semana)`);
                            continue;
                          }
                          
                          
                           // ✅ Buscar TODOS os agendamentos ativos do período (sem filtro de created_at)
                           let queryFuturos = supabase
                             .from('agendamentos')
                             .select('id, atendimento_id, hora_agendamento, created_at')
                             .eq('medico_id', medico.id)
                             .eq('data_agendamento', dataFuturaStr)
                             .eq('cliente_id', clienteId)
                             .is('excluido_em', null)
                             .is('cancelado_em', null)
                             .in('status', ['agendado', 'confirmado']);
                          
                          // 🆕 Filtrar por horário do período de CONTAGEM
                          if (inicioContagem && fimContagem) {
                            queryFuturos = queryFuturos
                              .gte('hora_agendamento', inicioContagem)
                              .lt('hora_agendamento', fimContagem);
                          }
                          
                          const { data: agendadosFuturos, error: errorFuturo } = await queryFuturos;
                          
                          if (errorFuturo) {
                            console.error(`❌ Erro ao buscar agendamentos para ${dataFuturaStr}:`, errorFuturo);
                            continue;
                          }
                          
                          const ocupadasFuturo = agendadosFuturos?.length || 0;
                          console.log(`📊 ${dataFuturaStr}: ${ocupadasFuturo}/${configPeriodo.limite} vagas ocupadas`);
                          
                          if (ocupadasFuturo < configPeriodo.limite) {
                            const diasSemanaArr = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                            const vagasLivres = configPeriodo.limite - ocupadasFuturo;
                            console.log(`✅ Data disponível encontrada: ${dataFuturaStr} - ${vagasLivres} vaga(s) livre(s)`);
                            
                            proximasDatasDisponiveis.push({
                              data: dataFuturaStr,
                              dia_semana: diasSemanaArr[diaSemana],
                              vagas_disponiveis: vagasLivres,
                              total_vagas: configPeriodo.limite
                            });
                            
                            if (proximasDatasDisponiveis.length >= 5) {
                              console.log(`✅ Encontradas 5 datas disponíveis, parando busca.`);
                              break;
                            }
                          }
                        }
                        
                        console.log(`📊 Total de datas alternativas encontradas: ${proximasDatasDisponiveis.length}`);
                      } catch (err) {
                        console.error('❌ Erro ao buscar datas futuras:', err);
                      }
                      
                      // Construir mensagem amigável para WhatsApp
                      let mensagemUsuario = `❌ Não há mais vagas para ${regras.nome} - ${servicoKeyValidacao} em ${data_consulta}.\n\n`;
                      mensagemUsuario += `📊 Status: ${vagasOcupadas}/${configPeriodo.limite} vagas ocupadas\n\n`;
                      
                      if (proximasDatasDisponiveis.length > 0) {
                        mensagemUsuario += `✅ Próximas datas disponíveis:\n\n`;
                        proximasDatasDisponiveis.forEach(d => {
                          mensagemUsuario += `📅 ${d.data} (${d.dia_semana}) - ${d.vagas_disponiveis} vaga(s)\n`;
                        });
                        mensagemUsuario += `\n💡 Gostaria de agendar em uma destas datas?`;
                      } else {
                        mensagemUsuario += `⚠️ Não encontramos vagas nos próximos 60 dias.\n`;
                        mensagemUsuario += `Por favor, entre em contato com a clínica para mais opções.`;
                      }
                      
                      return businessErrorResponse({
                        codigo_erro: 'LIMITE_VAGAS_ATINGIDO',
                        mensagem_usuario: mensagemUsuario,
                        detalhes: {
                          medico: regras.nome,
                          servico: servicoKeyValidacao,
                          data_solicitada: data_consulta,
                          limite_vagas: configPeriodo.limite,
                          vagas_ocupadas: vagasOcupadas,
                          vagas_disponiveis: 0
                        },
                        sugestoes: proximasDatasDisponiveis.length > 0 ? {
                          proximas_datas: proximasDatasDisponiveis,
                          acao_sugerida: 'reagendar_data_alternativa'
                        } : null
                      });
                    }
                    console.log(`✅ Vagas disponíveis: ${configPeriodo.limite - vagasOcupadas}`);
                  }
                }
              }
            } else {
              console.log(`⚠️ Serviço "${atendimento_nome}" não encontrado nas regras, prosseguindo sem validação específica`);
            }
          } catch (validationError: any) {
            console.error(`❌ Erro ao validar serviço:`, validationError);
            console.error(`📋 Stack:`, validationError.stack);
            // Não bloquear o agendamento por erro de validação
            console.log(`⚠️ Prosseguindo sem validação de serviço devido a erro`);
          }
        }
      }
    } else {
      console.log(`ℹ️ Médico ${medico.nome} sem regras específicas - prosseguindo com agendamento padrão`);
    }

    // Buscar atendimento por nome (se especificado) COM filtro de cliente
    let atendimento_id = null;
    if (atendimento_nome) {
      console.log(`🔍 Buscando atendimento: "${atendimento_nome}" para médico ${medico.nome}`);
      
      // Tentativa 1: Busca pelo nome fornecido
      let { data: atendimento, error: atendimentoError } = await supabase
        .from('atendimentos')
        .select('id, nome, tipo')
        .ilike('nome', `%${atendimento_nome}%`)
        .eq('medico_id', medico.id)
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .single();

      // Tentativa 2: Fallback inteligente por tipo
      if (atendimentoError || !atendimento) {
        console.log(`⚠️ Não encontrado com nome exato, tentando busca por tipo...`);
        
        const nomeLower = atendimento_nome.toLowerCase();
        let tipoAtendimento = null;
        
        // Detectar tipo baseado em palavras-chave
        if (nomeLower.includes('consult')) {
          tipoAtendimento = 'consulta';
        } else if (nomeLower.includes('retorn')) {
          tipoAtendimento = 'retorno';
        } else if (nomeLower.includes('exam')) {
          tipoAtendimento = 'exame';
        }
        
        if (tipoAtendimento) {
          console.log(`🎯 Detectado tipo: ${tipoAtendimento}, buscando...`);
          
          const { data: atendimentosPorTipo } = await supabase
            .from('atendimentos')
            .select('id, nome, tipo')
            .eq('tipo', tipoAtendimento)
            .eq('medico_id', medico.id)
            .eq('cliente_id', clienteId)
            .eq('ativo', true)
            .limit(1);
          
          if (atendimentosPorTipo && atendimentosPorTipo.length > 0) {
            atendimento = atendimentosPorTipo[0];
            console.log(`✅ Encontrado por tipo: ${atendimento.nome}`);
          }
        }
      }

      // Se ainda não encontrou, listar opções disponíveis
      if (!atendimento) {
        const { data: atendimentosDisponiveis } = await supabase
          .from('atendimentos')
          .select('nome, tipo')
          .eq('medico_id', medico.id)
          .eq('cliente_id', clienteId)
          .eq('ativo', true);
        
        const listaAtendimentos = atendimentosDisponiveis
          ?.map(a => `"${a.nome}" (${a.tipo})`)
          .join(', ') || 'nenhum';
        
        console.error(`❌ Atendimento "${atendimento_nome}" não encontrado. Disponíveis: ${listaAtendimentos}`);
        
        return businessErrorResponse({
          codigo_erro: 'SERVICO_NAO_ENCONTRADO',
          mensagem_usuario: `❌ O serviço "${atendimento_nome}" não foi encontrado para ${medico.nome}.\n\n✅ Serviços disponíveis:\n${atendimentosDisponiveis?.map(a => `   • ${a.nome} (${a.tipo})`).join('\n') || '   (nenhum cadastrado)'}\n\n💡 Escolha um dos serviços disponíveis acima.`,
          detalhes: {
            servico_solicitado: atendimento_nome,
            medico: medico.nome,
            servicos_disponiveis: atendimentosDisponiveis || []
          }
        });
      }
      
      atendimento_id = atendimento.id;
      console.log(`✅ Atendimento selecionado: ${atendimento.nome} (ID: ${atendimento_id})`);
      
    } else {
      // Buscar primeiro atendimento disponível do médico COM filtro de cliente
      console.log(`🔍 Nenhum atendimento especificado, buscando primeiro disponível...`);
      const { data: atendimentos } = await supabase
        .from('atendimentos')
        .select('id, nome')
        .eq('medico_id', medico.id)
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .limit(1);

      if (!atendimentos || atendimentos.length === 0) {
        return errorResponse(`Nenhum atendimento disponível para o médico ${medico.nome}`);
      }
      atendimento_id = atendimentos[0].id;
      console.log(`✅ Primeiro atendimento disponível selecionado: ${atendimentos[0].nome}`);
    }

    // 🆕 PARSEAR INTERVALO DE HORÁRIO (ex: "13:00 às 15:00" → "13:00")
    let horarioFinal = hora_consulta;
    
    // Se vier um intervalo, extrair apenas o horário de início
    const intervaloMatch = hora_consulta.match(/^(\d{1,2}:\d{2})\s*(?:às|as|a|-|até)\s*\d{1,2}:\d{2}$/i);
    if (intervaloMatch) {
      horarioFinal = intervaloMatch[1];
      console.log(`🔄 Detectado intervalo "${hora_consulta}". Usando horário de início: ${horarioFinal}`);
    }
    
    // 🆕 SE HORA_CONSULTA FOR PERÍODO, BUSCAR HORÁRIO ESPECÍFICO AUTOMATICAMENTE
    
    // Detectar se é período ("manhã", "tarde", "noite") ao invés de horário específico
    const isPeriodo = /^(manh[aã]|tarde|noite)$/i.test(horarioFinal);
    
    if (isPeriodo) {
      console.log(`🔄 Detectado período "${hora_consulta}" ao invés de horário específico. Buscando primeiro horário disponível...`);
      
      // Normalizar período
      const periodoNormalizado = hora_consulta.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/manha/g, 'manha')
        .replace(/tarde/g, 'tarde')
        .replace(/noite/g, 'noite');
      
      // Buscar regras do médico (dinâmico primeiro, fallback hardcoded)
      const regras = getMedicoRules(config, medico.id, BUSINESS_RULES.medicos[medico.id]);
      
      if (regras && regras.servicos) {
        // Encontrar serviço
        const servicoKey = Object.keys(regras.servicos).find(s => 
          s.toLowerCase().includes(atendimento_nome.toLowerCase()) ||
          atendimento_nome.toLowerCase().includes(s.toLowerCase())
        );
        
        if (servicoKey) {
          const servico = regras.servicos[servicoKey];
          const configPeriodo = servico.periodos?.[periodoNormalizado];
          
          if (configPeriodo) {
            if (regras.tipo_agendamento === 'hora_marcada') {
              // HORA MARCADA: buscar primeiro horário disponível
              console.log(`🕒 Buscando slots disponíveis para hora marcada no período ${periodoNormalizado}`);
              
              const intervaloMinutos = configPeriodo.intervalo_minutos || 30;
              const [horaInicio, minInicio] = configPeriodo.inicio.split(':').map(Number);
              const [horaFim, minFim] = configPeriodo.fim.split(':').map(Number);
              
              let horaAtual = horaInicio * 60 + minInicio;
              const horaLimite = horaFim * 60 + minFim;
              
              // Buscar primeiro slot livre
              while (horaAtual < horaLimite) {
                const h = Math.floor(horaAtual / 60);
                const m = horaAtual % 60;
                const horarioTeste = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
                
                // Verificar se este horário está disponível
                const { count } = await supabase
                  .from('agendamentos')
                  .select('*', { count: 'exact', head: true })
                  .eq('medico_id', medico.id)
                  .eq('data_agendamento', data_consulta)
                  .eq('hora_agendamento', horarioTeste)
                  .eq('cliente_id', clienteId)
                  .is('excluido_em', null)
                  .in('status', ['agendado', 'confirmado']);
                
                if (count === 0) {
                  console.log(`✅ Primeiro horário disponível encontrado: ${horarioTeste}`);
                  horarioFinal = horarioTeste;
                  break;
                }
                
                horaAtual += intervaloMinutos;
              }
              
              if (horarioFinal === hora_consulta) {
                // Não encontrou nenhum horário livre
                return errorResponse(
                  `❌ Não há horários disponíveis no período da ${hora_consulta} em ${data_consulta}.\n\n` +
                  `💡 Por favor, consulte a disponibilidade primeiro ou escolha outro período.`
                );
              }
            } else {
              // ORDEM DE CHEGADA: buscar primeiro horário LIVRE (não fixo!)
              console.log(`📋 Ordem de chegada: buscando primeiro horário livre no período ${periodoNormalizado}`);
              
              const intervaloMinutos = 1; // Incremento de 1min para ordem de chegada
              const [horaInicio, minInicio] = configPeriodo.inicio.split(':').map(Number);
              const [horaFim, minFim] = configPeriodo.fim.split(':').map(Number);
              
              let horaAtual = horaInicio * 60 + minInicio;
              const horaLimite = horaFim * 60 + minFim;
              
              // Buscar primeiro minuto livre
              while (horaAtual < horaLimite) {
                const h = Math.floor(horaAtual / 60);
                const m = horaAtual % 60;
                const horarioTeste = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
                
                // Verificar se este horário está disponível
                const { count } = await supabase
                  .from('agendamentos')
                  .select('*', { count: 'exact', head: true })
                  .eq('medico_id', medico.id)
                  .eq('data_agendamento', data_consulta)
                  .eq('hora_agendamento', horarioTeste)
                  .eq('cliente_id', clienteId)
                  .is('excluido_em', null)
                  .in('status', ['agendado', 'confirmado']);
                
                if (count === 0) {
                  console.log(`✅ Primeiro horário livre encontrado: ${horarioTeste}`);
                  horarioFinal = horarioTeste;
                  break;
                }
                
                horaAtual += intervaloMinutos;
              }
              
              if (horarioFinal === hora_consulta) {
                // Não encontrou nenhum horário livre no período
                return errorResponse(
                  `❌ Não há horários disponíveis no período da ${hora_consulta} em ${data_consulta}.\n\n` +
                  `💡 Todas as vagas da ${hora_consulta} já foram ocupadas. Consulte a disponibilidade para ver outros períodos.`
                );
              }
            }
          } else {
            return errorResponse(
              `❌ O médico ${medico.nome} não atende no período da ${hora_consulta}.\n\n` +
              `💡 Por favor, consulte a disponibilidade primeiro para ver os períodos disponíveis.`
            );
          }
        } else {
          return errorResponse(
            `❌ Não foi possível validar o serviço "${atendimento_nome}".\n\n` +
            `💡 Por favor, especifique um horário específico (ex: "08:00") ao invés de um período.`
          );
        }
      } else {
        return errorResponse(
          `❌ Período "${hora_consulta}" detectado, mas não há regras configuradas para este médico.\n\n` +
          `💡 Por favor, especifique um horário específico no formato HH:MM (ex: "08:00").`
        );
      }
      
      console.log(`🎯 Horário final selecionado: ${horarioFinal} (convertido de "${hora_consulta}")`);
    }

    // Criar agendamento usando a função atômica
    console.log(`📅 Criando agendamento para ${paciente_nome} com médico ${medico.nome} às ${horarioFinal}`);
    
    const { data: result, error: agendamentoError } = await supabase
      .rpc('criar_agendamento_atomico_externo', {
        p_cliente_id: clienteId, // 🆕 Passar cliente_id explicitamente
        p_nome_completo: paciente_nome.toUpperCase(),
        p_data_nascimento: data_nascimento,
        p_convenio: formatarConvenioParaBanco(convenio), // ✅ Formatar para padrão do banco
        p_telefone: telefone || null,
        p_celular: celular,
        p_medico_id: medico.id,
        p_atendimento_id: atendimento_id,
        p_data_agendamento: data_consulta,
        p_hora_agendamento: horarioFinal, // 🆕 Usar horário convertido
        p_observacoes: (observacoes || 'Agendamento via LLM Agent WhatsApp').toUpperCase(),
        p_criado_por: 'LLM Agent WhatsApp',
        p_force_conflict: false
      });

    console.log('📋 Resultado da função:', { result, agendamentoError });

    if (agendamentoError) {
      console.error('❌ Erro na função criar_agendamento_atomico_externo:', agendamentoError);
      return errorResponse(`Erro ao agendar: ${agendamentoError.message}`);
    }

    if (!result?.success) {
      console.error('❌ Função retornou erro:', result);
      
      // 🆕 SE FOR CONFLITO DE HORÁRIO, TENTAR ALOCAR AUTOMATICAMENTE MINUTO A MINUTO
      if (result?.error === 'CONFLICT') {
        console.log('🔄 Conflito detectado, iniciando busca minuto a minuto...');
        
        // Determinar período baseado no horário FINAL (não hora_consulta!)
        const [hora] = horarioFinal.split(':').map(Number);
        let periodoConfig = null;
        let nomePeriodo = '';
        
        // Buscar regras do médico (dinâmico primeiro, fallback hardcoded)
        const regrasMedico = getMedicoRules(config, medico.id, BUSINESS_RULES.medicos[medico.id]);
        if (regrasMedico) {
          const servicoKey = Object.keys(regrasMedico.servicos)[0];
          const servico = normalizarServicoPeriodos(regrasMedico.servicos[servicoKey]);
          // Determinar se é manhã ou tarde
          if (servico.periodos?.manha) {
            const [hInicio] = servico.periodos.manha.inicio.split(':').map(Number);
            const [hFim] = servico.periodos.manha.fim.split(':').map(Number);
            if (hora >= hInicio && hora < hFim) {
              periodoConfig = servico.periodos.manha;
              nomePeriodo = 'manhã';
            }
          }
          
          if (!periodoConfig && servico.periodos?.tarde) {
            const [hInicio] = servico.periodos.tarde.inicio.split(':').map(Number);
            const [hFim] = servico.periodos.tarde.fim.split(':').map(Number);
            if (hora >= hInicio && hora < hFim) {
              periodoConfig = servico.periodos.tarde;
              nomePeriodo = 'tarde';
            }
          }
        }
        
        // Se encontrou período válido, fazer loop minuto a minuto
        if (periodoConfig) {
          console.log(`📋 Período detectado: ${nomePeriodo} (${periodoConfig.inicio}-${periodoConfig.fim}, limite: ${periodoConfig.limite})`);
          
          // Calcular minutos do período
          const [hInicio, minInicio] = periodoConfig.inicio.split(':').map(Number);
          const [hFim, minFim] = periodoConfig.fim.split(':').map(Number);
          const minutoInicio = hInicio * 60 + minInicio;
          const minutoFim = hFim * 60 + minFim;
          
          console.log(`🔍 Iniciando busca de ${periodoConfig.inicio} até ${periodoConfig.fim} (${minutoFim - minutoInicio} minutos)`);
          
          let tentativas = 0;
          let horarioAlocado = null;
          let resultadoFinal = null;
          
          // Loop minuto a minuto
          for (let minutoAtual = minutoInicio; minutoAtual < minutoFim; minutoAtual++) {
            tentativas++;
            const hora = Math.floor(minutoAtual / 60);
            const min = minutoAtual % 60;
            const horarioTeste = `${String(hora).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
            
            console.log(`🔁 Tentativa ${tentativas}: Testando ${horarioTeste}...`);
            
            // Tentar agendar neste minuto
            const { data: tentativaResult, error: tentativaError } = await supabase
              .rpc('criar_agendamento_atomico_externo', {
                p_cliente_id: clienteId,
                p_nome_completo: paciente_nome.toUpperCase(),
                p_data_nascimento: data_nascimento,
                p_convenio: formatarConvenioParaBanco(convenio), // ✅ Formatar para padrão do banco
                p_telefone: telefone || null,
                p_celular: celular,
                p_medico_id: medico.id,
                p_atendimento_id: atendimento_id,
                p_data_agendamento: data_consulta,
                p_hora_agendamento: horarioTeste,
                p_observacoes: (observacoes || 'Agendamento via LLM Agent WhatsApp').toUpperCase(),
                p_criado_por: 'LLM Agent WhatsApp',
                p_force_conflict: false
              });
            
            // Verificar resultado
            if (tentativaError) {
              console.error(`❌ Erro inesperado em ${horarioTeste}:`, tentativaError);
              // Continuar tentando outros horários mesmo com erro
              continue;
            }
            
            if (tentativaResult?.success) {
              // ✅ SUCESSO! Encontramos um horário livre
              console.log(`✅ SUCESSO! Agendado em ${horarioTeste} após ${tentativas} tentativas`);
              horarioAlocado = horarioTeste;
              resultadoFinal = tentativaResult;
              break;
            }
            
            if (tentativaResult?.error === 'CONFLICT') {
              // Horário ocupado, continuar para o próximo
              console.log(`⏭️  ${horarioTeste} ocupado, tentando próximo...`);
              continue;
            }
            
            // Outro tipo de erro (idade, convênio, etc.) - parar o loop
            console.error(`⚠️ Erro não-conflito em ${horarioTeste}:`, tentativaResult?.error);
            return businessErrorResponse({
              codigo_erro: tentativaResult?.error || 'ERRO_DESCONHECIDO',
              mensagem_usuario: tentativaResult?.message || `Erro ao tentar agendar: ${tentativaResult?.error}`,
              detalhes: { horario: horarioTeste }
            });
          }
          
          // Verificar se conseguiu alocar
          if (horarioAlocado && resultadoFinal) {
            // 🆕 Usar mesma lógica detalhada de mensagem (prefixo + período + orientações)
            let mensagem = '';
            let temOrientacoes = false;
            
            // Buscar mensagem de confirmação personalizada
            const msgConfirmacao = getMensagemPersonalizada(config, 'confirmacao_agendamento', medico.id);
            const msgPagamento = getMensagemPersonalizada(config, 'pagamento', medico.id);
            
            const dataFormatada = new Date(data_consulta + 'T00:00:00').toLocaleDateString('pt-BR');
            const [hAlocado] = horarioAlocado.split(':').map(Number);
            
            if (msgConfirmacao) {
              mensagem = `✅ ${msgConfirmacao}`;
            } else {
              // 🆕 USAR PREFIXO PERSONALIZADO E DISTRIBUICAO_FICHAS
              let prefixoFinal = 'Consulta agendada';
              let periodoNomeConf = '';
              let periodoHorarioConf = '';
              let atendimentoInicioConf = '';
              
              // Buscar config do serviço para informações detalhadas
              // 🔧 FIX: Usar regrasMedico (já declarado na linha 2724) ao invés de regrasMedicoSchedule
              if (regrasMedico?.servicos) {
                const servicoKey = Object.keys(regrasMedico.servicos)[0];
                const servicoAtualRaw = regrasMedico.servicos[servicoKey];
                const servicoAtual = normalizarServicoPeriodos(servicoAtualRaw);
                
                // 1️⃣ PREFIXO PERSONALIZADO
                prefixoFinal = servicoAtual?.prefixo_mensagem || 'Consulta agendada';
                
                if (servicoAtual?.periodos) {
                  // 2️⃣ DETECTAR PERÍODO BASEADO NO HORÁRIO ALOCADO
                  if (servicoAtual.periodos.manha) {
                    const manha = servicoAtual.periodos.manha;
                    const horaInicioM = manha.inicio || manha.horario_inicio;
                    const horaFimM = manha.fim || manha.horario_fim;
                    if (horaInicioM && horaFimM) {
                      const [hInicioM] = horaInicioM.split(':').map(Number);
                      const [hFimM] = horaFimM.split(':').map(Number);
                      if (hAlocado >= hInicioM && hAlocado < hFimM) {
                        periodoNomeConf = 'manhã';
                        periodoHorarioConf = manha.distribuicao_fichas || `${horaInicioM.substring(0,5)} às ${horaFimM.substring(0,5)}`;
                        atendimentoInicioConf = manha.atendimento_inicio || '';
                      }
                    }
                  }
                  if (!periodoNomeConf && servicoAtual.periodos.tarde) {
                    const tarde = servicoAtual.periodos.tarde;
                    const horaInicioT = tarde.inicio || tarde.horario_inicio;
                    const horaFimT = tarde.fim || tarde.horario_fim;
                    if (horaInicioT && horaFimT) {
                      const [hInicioT] = horaInicioT.split(':').map(Number);
                      const [hFimT] = horaFimT.split(':').map(Number);
                      if (hAlocado >= hInicioT && hAlocado < hFimT) {
                        periodoNomeConf = 'tarde';
                        periodoHorarioConf = tarde.distribuicao_fichas || `${horaInicioT.substring(0,5)} às ${horaFimT.substring(0,5)}`;
                        atendimentoInicioConf = tarde.atendimento_inicio || '';
                      }
                    }
                  }
                }
                
                // 3️⃣ VERIFICAR SE TEM ORIENTAÇÕES
                if (servicoAtual?.orientacoes) {
                  temOrientacoes = true;
                }
                
                // 5️⃣ ANEXAR ORIENTAÇÕES AO FINAL (movido para dentro do if)
                if (servicoAtual?.orientacoes) {
                  // Será anexado após gerar a mensagem base
                }
              }
              
              // 4️⃣ GERAR MENSAGEM COM PREFIXO E PERÍODO DETALHADO
              if (periodoNomeConf && periodoHorarioConf) {
                if (atendimentoInicioConf) {
                  mensagem = `✅ ${prefixoFinal} para ${paciente_nome} em ${dataFormatada} no período da ${periodoNomeConf} (${periodoHorarioConf}). Dr. começa a atender às ${atendimentoInicioConf}, por ordem de chegada.`;
                } else {
                  mensagem = `✅ ${prefixoFinal} para ${paciente_nome} em ${dataFormatada} no período da ${periodoNomeConf} (${periodoHorarioConf}), por ordem de chegada.`;
                }
              } else {
                mensagem = `✅ ${prefixoFinal} para ${paciente_nome} em ${dataFormatada} por ordem de chegada.`;
              }
              
              // 5️⃣ ANEXAR ORIENTAÇÕES AO FINAL
              if (regrasMedico?.servicos) {
                const servicoKey = Object.keys(regrasMedico.servicos)[0];
                const servicoAtualRaw = regrasMedico.servicos[servicoKey];
                const servicoAtual = normalizarServicoPeriodos(servicoAtualRaw);
                if (servicoAtual?.orientacoes) {
                  mensagem += `\n\n${servicoAtual.orientacoes}`;
                }
              }
            }
            
            // Adicionar mensagem de pagamento se existir
            if (msgPagamento) {
              mensagem += `\n\n💰 ${msgPagamento}`;
            }
            
            // 6️⃣ SÓ ADICIONAR "POSSO AJUDAR..." SE NÃO TIVER ORIENTAÇÕES
            if (!temOrientacoes) {
              mensagem += `\n\nPosso ajudar em algo mais?`;
            }
            
            return successResponse({
              message: mensagem,
              agendamento_id: resultadoFinal.agendamento_id,
              paciente_id: resultadoFinal.paciente_id,
              data: data_consulta,
              hora: horarioAlocado,
              medico: medico.nome,
              atendimento: atendimento_nome || 'Consulta',
              validado: true,
              confirmacao_criado: true
            });
          }
          
          // Se chegou aqui, não conseguiu alocar em nenhum minuto
          console.log(`⚠️ Não foi possível alocar após ${tentativas} tentativas. Verificando estado do período...`);
          
          // 🔍 VERIFICAR CONTAGEM REAL DE AGENDAMENTOS NO PERÍODO
          // 🆕 Usar contagem_inicio/contagem_fim se configurados
          const inicioContagemFinal = periodoConfig.contagem_inicio || periodoConfig.inicio;
          const fimContagemFinal = periodoConfig.contagem_fim || periodoConfig.fim;
          const [hInicioContagem, mInicioContagem] = inicioContagemFinal.split(':').map(Number);
          const [hFimContagem, mFimContagem] = fimContagemFinal.split(':').map(Number);
          const minInicioContagem = hInicioContagem * 60 + mInicioContagem;
          const minFimContagem = hFimContagem * 60 + mFimContagem;
          
          console.log(`🔢 [CONTAGEM FINAL] Exibição: ${periodoConfig.inicio}-${periodoConfig.fim}, Contagem: ${inicioContagemFinal}-${fimContagemFinal}`);
          
          const { data: agendamentosDoPeriodo } = await supabase
            .from('agendamentos')
            .select('hora_agendamento')
            .eq('medico_id', medico.id)
            .eq('data_agendamento', data_consulta)
            .eq('cliente_id', clienteId)
            .in('status', ['agendado', 'confirmado']);
          
          const agendamentosNoPeriodo = agendamentosDoPeriodo?.filter(a => {
            const [h, m] = a.hora_agendamento.split(':').map(Number);
            const minutoAgendamento = h * 60 + m;
            return minutoAgendamento >= minInicioContagem && minutoAgendamento < minFimContagem;
          }) || [];
          
          const vagasOcupadas = agendamentosNoPeriodo.length;
          const vagasDisponiveis = periodoConfig.limite - vagasOcupadas;
          
          console.log(`📊 Estado final: ${vagasOcupadas}/${periodoConfig.limite} vagas ocupadas no período ${nomePeriodo}`);
          
          if (vagasDisponiveis <= 0) {
            // Período realmente lotado
            console.log(`❌ Período ${nomePeriodo} está completamente lotado`);
            return businessErrorResponse({
              codigo_erro: 'PERIODO_LOTADO',
              mensagem_usuario: `O período da ${nomePeriodo} está com todas as vagas ocupadas (${vagasOcupadas}/${periodoConfig.limite}). Por favor, escolha outro período ou outro dia.`,
              detalhes: {
                periodo: nomePeriodo,
                vagas_ocupadas: vagasOcupadas,
                vagas_total: periodoConfig.limite,
                data_solicitada: data_consulta,
                tentativas_realizadas: tentativas
              }
            });
          } else {
            // Tem vagas mas nenhum minuto passou na função atômica
            console.log(`⚠️ Período tem ${vagasDisponiveis} vaga(s) mas nenhum horário foi aceito pelo banco após ${tentativas} tentativas`);
            return businessErrorResponse({
              codigo_erro: 'ALOCACAO_FALHOU',
              mensagem_usuario: `Não foi possível encontrar um horário disponível no período da ${nomePeriodo}. Foram testados ${tentativas} minutos, mas todos apresentaram conflitos. Por favor, tente outro período ou entre em contato.`,
              detalhes: {
                periodo: nomePeriodo,
                vagas_disponiveis: vagasDisponiveis,
                vagas_ocupadas: vagasOcupadas,
                vagas_total: periodoConfig.limite,
                data_solicitada: data_consulta,
                tentativas_realizadas: tentativas,
                sugestao: 'O sistema pode estar com alta demanda ou há restrições específicas. Tente outro período.'
              }
            });
          }
        }
      }
      
      // Para outros erros, manter comportamento original
      return errorResponse(result?.error || result?.message || 'Erro desconhecido', 'ERRO_AGENDAMENTO');
    }

    console.log('✅ Agendamento criado com sucesso:', result);

    // 🆕 Usar mensagens dinâmicas do banco em vez de hardcoded
    const dataFormatada = new Date(data_consulta + 'T00:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    const horaFormatada = horarioFinal.substring(0, 5); // "08:00:00" → "08:00"
    const [hora] = horarioFinal.split(':').map(Number);
    
    // 🆕 Determinar tipo de agendamento efetivo
    const regrasMedicoSchedule = getMedicoRules(config, medico.id, BUSINESS_RULES.medicos[medico.id]);
    const servicoSchedule = atendimento_nome ? Object.entries(regrasMedicoSchedule?.servicos || {}).find(([nomeServico, _cfg]: [string, any]) => {
      return nomeServico.toLowerCase().includes(atendimento_nome.toLowerCase()) ||
             atendimento_nome.toLowerCase().includes(nomeServico.toLowerCase());
    }) : null;
    // Extrair o config do serviço se encontrado (o find retorna [key, value])
    const servicoConfigSchedule = servicoSchedule ? servicoSchedule[1] : null;
    const tipoEfetivoSchedule = getTipoAgendamentoEfetivo(servicoConfigSchedule, regrasMedicoSchedule);
    
    console.log(`📋 [CONFIRMAÇÃO] Tipo efetivo: ${tipoEfetivoSchedule}`);
    
    // Buscar mensagens personalizadas do banco
    const msgConfirmacao = getMensagemPersonalizada(config, 'confirmacao_agendamento', medico.id);
    const msgPagamento = getMensagemPersonalizada(config, 'pagamento', medico.id);
    
    let mensagem = '';
    let temOrientacoes = false;
    
    if (msgConfirmacao) {
      // Usar mensagem personalizada do banco
      mensagem = `✅ ${msgConfirmacao}`;
    } else {
      // 🆕 Mensagem diferenciada por tipo de agendamento
      if (isEstimativaHorario(tipoEfetivoSchedule)) {
        const mensagemEst = getMensagemEstimativa(servicoConfigSchedule, null);
        mensagem = `✅ Consulta agendada para ${paciente_nome} em ${dataFormatada} por volta das ${horaFormatada}.\n\n⏰ ${mensagemEst}`;
      } else if (isOrdemChegada(tipoEfetivoSchedule)) {
        // Determinar período e horário baseado na hora do agendamento
        let periodoNomeConf = '';
        let periodoHorarioConf = '';
        
        // Buscar config do período para informações detalhadas
        let atendimentoInicioConf = '';
        
        if (regrasMedicoSchedule?.servicos) {
          const servicoAtualRaw = servicoConfigSchedule || Object.values(regrasMedicoSchedule.servicos)[0];
          const servicoAtual = normalizarServicoPeriodos(servicoAtualRaw);
          
          // 1️⃣ BUSCAR PREFIXO PERSONALIZADO (ou usar padrão)
          const prefixoMensagem = servicoAtual?.prefixo_mensagem || 'Consulta agendada';
          
          if (servicoAtual?.periodos) {
            // 2️⃣ NORMALIZAR CAMPOS (aceitar ambas nomenclaturas)
            if (servicoAtual.periodos.manha) {
              const manha = servicoAtual.periodos.manha;
              const horaInicioM = manha.inicio || manha.horario_inicio;
              const horaFimM = manha.fim || manha.horario_fim;
              
              if (horaInicioM && horaFimM) {
                const [hInicioM] = horaInicioM.split(':').map(Number);
                const [hFimM] = horaFimM.split(':').map(Number);
                if (hora >= hInicioM && hora < hFimM) {
                  periodoNomeConf = 'manhã';
                  // 3️⃣ PRIORIZAR distribuicao_fichas para horário do paciente
                  periodoHorarioConf = manha.distribuicao_fichas || 
                                       `${horaInicioM.substring(0,5)} às ${horaFimM.substring(0,5)}`;
                  // 4️⃣ CAPTURAR atendimento_inicio
                  atendimentoInicioConf = manha.atendimento_inicio || '';
                }
              }
            }
            if (!periodoNomeConf && servicoAtual.periodos.tarde) {
              const tarde = servicoAtual.periodos.tarde;
              const horaInicioT = tarde.inicio || tarde.horario_inicio;
              const horaFimT = tarde.fim || tarde.horario_fim;
              
              if (horaInicioT && horaFimT) {
                const [hInicioT] = horaInicioT.split(':').map(Number);
                const [hFimT] = horaFimT.split(':').map(Number);
                if (hora >= hInicioT && hora < hFimT) {
                  periodoNomeConf = 'tarde';
                  // 3️⃣ PRIORIZAR distribuicao_fichas para horário do paciente
                  periodoHorarioConf = tarde.distribuicao_fichas || 
                                       `${horaInicioT.substring(0,5)} às ${horaFimT.substring(0,5)}`;
                  // 4️⃣ CAPTURAR atendimento_inicio
                  atendimentoInicioConf = tarde.atendimento_inicio || '';
                }
              }
            }
          }
        }
        
        // Mensagem com período detalhado - usar prefixo configurável
        const prefixoFinal = (regrasMedicoSchedule?.servicos) 
          ? (normalizarServicoPeriodos(servicoConfigSchedule || Object.values(regrasMedicoSchedule.servicos)[0])?.prefixo_mensagem || 'Consulta agendada')
          : 'Consulta agendada';
        
        if (!mensagem && periodoNomeConf && periodoHorarioConf) {
          if (atendimentoInicioConf) {
            mensagem = `✅ ${prefixoFinal} para ${paciente_nome} em ${dataFormatada} no período da ${periodoNomeConf} (${periodoHorarioConf}). Dr. começa a atender às ${atendimentoInicioConf}, por ordem de chegada.`;
          } else {
            mensagem = `✅ ${prefixoFinal} para ${paciente_nome} em ${dataFormatada} no período da ${periodoNomeConf} (${periodoHorarioConf}), por ordem de chegada.`;
          }
        } else if (!mensagem) {
          // Fallback simples se não encontrar config
          mensagem = `✅ ${prefixoFinal} para ${paciente_nome} em ${dataFormatada} por ordem de chegada.`;
        }
        
        // 5️⃣ ANEXAR ORIENTAÇÕES DO SERVIÇO (se existirem)
        if (regrasMedicoSchedule?.servicos) {
          const servicoAtualRaw = servicoConfigSchedule || Object.values(regrasMedicoSchedule.servicos)[0];
          const servicoAtual = normalizarServicoPeriodos(servicoAtualRaw);
          if (servicoAtual?.orientacoes) {
            mensagem += `\n\n${servicoAtual.orientacoes}`;
            temOrientacoes = true;
          }
        }
      } else {
        // Hora marcada
        mensagem = `✅ Consulta agendada para ${paciente_nome} em ${dataFormatada} às ${horaFormatada}.`;
      }
    }
    
    // Adicionar informação de período baseado na hora
    let periodoInfo = '';
    if (hora >= 7 && hora < 12) {
      periodoInfo = 'manhã';
    } else if (hora >= 13 && hora < 18) {
      periodoInfo = 'tarde';
    }
    
    // Adicionar mensagem de pagamento se existir
    if (msgPagamento) {
      mensagem += `\n\n💰 ${msgPagamento}`;
    }
    
    // Só adicionar "Posso ajudar..." se NÃO tiver orientações anexadas
    if (!temOrientacoes) {
      mensagem += `\n\nPosso ajudar em algo mais?`;
    }
    
    console.log(`💬 Mensagem de confirmação: ${msgConfirmacao ? 'personalizada do banco' : 'genérica por tipo'}`);
    console.log(`💬 Tipo agendamento: ${tipoEfetivoSchedule}`);
    console.log(`💬 Mensagem de pagamento: ${msgPagamento ? 'personalizada do banco' : 'não configurada'}`);

    return successResponse({
      message: mensagem,
      agendamento_id: result.agendamento_id,
      paciente_id: result.paciente_id,
      medico: medico.nome,
      data: data_consulta,
      hora: hora_consulta,
      validado: true,
      confirmacao_criado: true
    });

  } catch (error: any) {
    return errorResponse(`Erro ao processar agendamento: ${error?.message || 'Erro desconhecido'}`);
  }
}

// 🔧 CONSOLIDAÇÃO DE PACIENTES: Agrupa duplicatas e retorna registro único + todos IDs
interface ConsolidatedPatient {
  id: string;
  all_ids: string[]; // TODOS os IDs de duplicatas para buscar agendamentos
  nome_completo: string;
  data_nascimento: string;
  celular: string | null;
  telefone: string | null;
  ultimo_convenio: string;
  updated_at: string;
  created_at: string;
}

function consolidatePatients(patients: any[], lastConvenios: Record<string, string>): ConsolidatedPatient[] {
  const consolidated = new Map<string, ConsolidatedPatient>();
  
  patients.forEach(patient => {
    // Chave única: nome_completo (lowercase trim) + data_nascimento
    const key = `${patient.nome_completo.toLowerCase().trim()}-${patient.data_nascimento}`;
    
    if (consolidated.has(key)) {
      // Duplicata encontrada - adicionar ID ao array e usar o registro mais recente
      const existing = consolidated.get(key)!;
      existing.all_ids.push(patient.id);
      
      if (new Date(patient.updated_at) > new Date(existing.updated_at)) {
        existing.id = patient.id;
        existing.celular = patient.celular;
        existing.telefone = patient.telefone;
        existing.updated_at = patient.updated_at;
      }
    } else {
      // Primeiro registro deste paciente
      const ultimoConvenio = lastConvenios[key] || patient.convenio;
      
      consolidated.set(key, {
        id: patient.id,
        all_ids: [patient.id], // Iniciar array com o primeiro ID
        nome_completo: patient.nome_completo,
        data_nascimento: patient.data_nascimento,
        celular: patient.celular,
        telefone: patient.telefone,
        ultimo_convenio: ultimoConvenio,
        created_at: patient.created_at,
        updated_at: patient.updated_at,
      });
    }
  });
  
  return Array.from(consolidated.values());
}

// Listar agendamentos de um médico em uma data específica
async function handleListAppointments(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    const { medico_nome, data } = body;

    if (!medico_nome || !data) {
      return errorResponse('Campos obrigatórios: medico_nome, data (formato YYYY-MM-DD ou "CURRENT_DATE")');
    }

    // Normalizar data
    let dataFormatada = data;
    if (data === 'CURRENT_DATE' || data.toLowerCase() === 'hoje' || data.toLowerCase() === 'today') {
      dataFormatada = getDataAtualBrasil();
      console.log(`📅 Data convertida de "${data}" para ${dataFormatada}`);
    }

    // Validar formato de data
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataFormatada)) {
      return errorResponse('Data inválida. Use formato YYYY-MM-DD ou "CURRENT_DATE"');
    }

    console.log(`📋 Listando agendamentos: médico="${medico_nome}", data=${dataFormatada}`);

    // Chamar função do banco que retorna TODOS os médicos que correspondem à busca
    const { data: agendamentos, error } = await supabase
      .rpc('listar_agendamentos_medico_dia', {
        p_nome_medico: medico_nome,
        p_data: dataFormatada
      });

    if (error) {
      console.error('❌ Erro ao listar agendamentos:', error);
      return errorResponse(`Erro ao buscar agendamentos: ${error.message}`);
    }

    if (!agendamentos || agendamentos.length === 0) {
      const mensagem = `Não foi encontrado nenhum agendamento para o Dr. ${medico_nome} em ${dataFormatada}.`;
      return successResponse({
        encontrado: false,
        agendamentos: [],
        total: 0,
        message: mensagem,
        data_busca: dataFormatada,
        medico_busca: medico_nome
      });
    }

    // Agrupar por período e tipo de atendimento
    const manha = agendamentos.filter((a: any) => a.periodo === 'manhã');
    const tarde = agendamentos.filter((a: any) => a.periodo === 'tarde');
    
    // Contar tipos
    const tiposCount: Record<string, number> = {};
    agendamentos.forEach((a: any) => {
      tiposCount[a.tipo_atendimento] = (tiposCount[a.tipo_atendimento] || 0) + 1;
    });

    // Formatar mensagem amigável
    const tiposLista = Object.entries(tiposCount)
      .map(([tipo, qtd]) => `${qtd} ${tipo}${qtd > 1 ? 's' : ''}`)
      .join(', ');
    
    const mensagem = `Encontrei ${agendamentos.length} agendamento(s) para o Dr. ${medico_nome} em ${dataFormatada}:\n\n` +
      `📊 Resumo: ${tiposLista}\n\n` +
      (manha.length > 0 ? `☀️ Manhã: ${manha.length} agendamento(s)\n` : '') +
      (tarde.length > 0 ? `🌙 Tarde: ${tarde.length} agendamento(s)\n` : '');

    console.log(`✅ Encontrados ${agendamentos.length} agendamentos (${manha.length} manhã, ${tarde.length} tarde)`);

    return successResponse({
      encontrado: true,
      agendamentos: agendamentos,
      total: agendamentos.length,
      resumo: {
        total: agendamentos.length,
        manha: manha.length,
        tarde: tarde.length,
        tipos: tiposCount
      },
      message: mensagem,
      data_busca: dataFormatada,
      medico_busca: medico_nome
    });

  } catch (error: any) {
    console.error('❌ Erro ao processar list-appointments:', error);
    return errorResponse(`Erro ao processar requisição: ${error.message}`);
  }
}

// Verificar se paciente tem consultas agendadas
async function handleCheckPatient(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    // Sanitizar dados de busca
    const celularRaw = sanitizarCampoOpcional(body.celular);
    const dataNascimentoNormalizada = normalizarDataNascimento(
      sanitizarCampoOpcional(body.data_nascimento)
    );
    const pacienteNomeNormalizado = normalizarNome(
      sanitizarCampoOpcional(body.paciente_nome)
    );

    // 🔍 VERIFICAR CELULAR MASCARADO ANTES DE NORMALIZAR
    const isCelularMascarado = celularRaw ? celularRaw.includes('*') : false;
    const celularNormalizado = isCelularMascarado ? null : normalizarTelefone(celularRaw);

    // Log de busca
    console.log('🔍 Buscando paciente:', {
      nome: pacienteNomeNormalizado,
      nascimento: dataNascimentoNormalizada,
      celular: isCelularMascarado ? `${celularRaw} (MASCARADO - IGNORADO)` : (celularNormalizado ? `${celularNormalizado.substring(0, 4)}****` : null)
    });

    if (!pacienteNomeNormalizado && !dataNascimentoNormalizada && !celularNormalizado) {
      return errorResponse('Informe pelo menos: paciente_nome, data_nascimento ou celular para busca');
    }

    // 🔍 PASSO 1: Buscar TODOS os pacientes candidatos (BUSCA FUZZY MELHORADA)
    // Estratégia: Buscar por NOME + NASCIMENTO como filtros principais
    // O celular será usado apenas como filtro opcional em memória (não na query)
    let pacienteQuery = supabase
      .from('pacientes')
      .select('id, nome_completo, data_nascimento, celular, telefone, convenio, created_at, updated_at')
      .eq('cliente_id', clienteId);

    // Filtros principais: NOME + NASCIMENTO (sem celular)
    if (pacienteNomeNormalizado) {
      pacienteQuery = pacienteQuery.ilike('nome_completo', `%${pacienteNomeNormalizado}%`);
    }
    if (dataNascimentoNormalizada) {
      pacienteQuery = pacienteQuery.eq('data_nascimento', dataNascimentoNormalizada);
    }
    
    // 📝 Log de estratégia de busca
    if (celularNormalizado) {
      console.log('📞 Celular fornecido será usado para filtro fuzzy em memória:', celularNormalizado);
    } else if (isCelularMascarado) {
      console.log('⚠️ Celular mascarado detectado - buscando apenas por nome + nascimento:', celularRaw);
    }

    const { data: pacientesEncontrados, error: pacienteError } = await pacienteQuery;

    if (pacienteError) {
      return errorResponse(`Erro ao buscar paciente: ${pacienteError.message}`);
    }

    // Se não encontrou NENHUM paciente com esses dados
    if (!pacientesEncontrados || pacientesEncontrados.length === 0) {
      console.log('❌ Paciente não encontrado no sistema');
      const clinicPhone = getClinicPhone(config);
      return successResponse({
        encontrado: false,
        consultas: [],
        message: `Não encontrei agendamentos para este paciente. Para mais informações, entre em contato: ${clinicPhone}`,
        contato: clinicPhone,
        total: 0
      });
    }

    console.log(`🔍 Encontrados ${pacientesEncontrados.length} registros de pacientes antes do filtro de celular`);

    // 🎯 FILTRO FUZZY DE CELULAR (em memória, após busca)
    // Se celular foi fornecido, aplicar tolerância nos últimos dígitos
    // IMPORTANTE: Se houve match por nome + nascimento, NÃO eliminar — apenas ordenar
    let pacientesFiltrados = pacientesEncontrados;
    
    if (celularNormalizado && celularNormalizado.length >= 10) {
      const sufixoFornecido = celularNormalizado.slice(-4);
      const temMatchNomeNascimento = !!(pacienteNomeNormalizado && dataNascimentoNormalizada);
      
      if (temMatchNomeNascimento) {
        // Match por nome + nascimento: celular é apenas critério de ORDENAÇÃO, não eliminação
        console.log('🔍 Match por nome+nascimento detectado — celular usado apenas para ordenação (não elimina)');
        
        pacientesFiltrados = [...pacientesEncontrados].sort((a: any, b: any) => {
          const celA = normalizarTelefone(a.celular);
          const celB = normalizarTelefone(b.celular);
          const diffA = celA && celA.length >= 4 ? Math.abs(parseInt(celA.slice(-4)) - parseInt(sufixoFornecido)) : 9999;
          const diffB = celB && celB.length >= 4 ? Math.abs(parseInt(celB.slice(-4)) - parseInt(sufixoFornecido)) : 9999;
          return diffA - diffB;
        });
        
        // Log informativo sobre diferenças de celular
        pacientesFiltrados.forEach((p: any) => {
          const celP = normalizarTelefone(p.celular);
          if (celP && celP.length >= 4) {
            const sufP = celP.slice(-4);
            const diff = Math.abs(parseInt(sufP) - parseInt(sufixoFornecido));
            if (diff > 5) {
              console.log(`📱 Celular diferente mas MANTIDO por match nome+nascimento: ${sufP} vs ${sufixoFornecido} (diff=${diff}) - Paciente: ${p.nome_completo}`);
            }
          }
        });
      } else {
        // Sem match nome+nascimento: manter filtro rigoroso original
        console.log('🔍 Aplicando filtro fuzzy de celular RIGOROSO (sem match nome+nascimento)...');
        
        pacientesFiltrados = pacientesEncontrados.filter((p: any) => {
          if (!p.celular) return true;
          const celularPaciente = normalizarTelefone(p.celular);
          if (!celularPaciente || celularPaciente.length < 10) return true;
          const sufixoPaciente = celularPaciente.slice(-4);
          const diff = Math.abs(parseInt(sufixoPaciente) - parseInt(sufixoFornecido));
          const tolerado = diff <= 5;
          if (!tolerado) {
            console.log(`⚠️ Celular rejeitado por diferença: ${sufixoPaciente} vs ${sufixoFornecido} (diff=${diff})`);
          }
          return tolerado;
        });
      }
      
      console.log(`🔍 Após filtro fuzzy: ${pacientesFiltrados.length} de ${pacientesEncontrados.length} pacientes mantidos`);
    }

    console.log(`🔍 Total de registros após filtragem: ${pacientesFiltrados.length}`);

    // 🔄 PASSO 2: CONSOLIDAR DUPLICATAS
    // Buscar último convênio usado em agendamentos para cada paciente
    const pacienteIds = pacientesFiltrados.map((p: any) => p.id);
    const { data: ultimosAgendamentos } = await supabase
      .from('agendamentos')
      .select('paciente_id, convenio, data_agendamento, hora_agendamento')
      .in('paciente_id', pacienteIds)
      .order('data_agendamento', { ascending: false })
      .order('hora_agendamento', { ascending: false });

    // Mapear último convênio por chave (nome + nascimento)
    const lastConvenios: Record<string, string> = {};
    if (ultimosAgendamentos) {
      const patientToKeyMap: Record<string, string> = {};
      pacientesFiltrados.forEach((p: any) => {
        patientToKeyMap[p.id] = `${p.nome_completo.toLowerCase().trim()}-${p.data_nascimento}`;
      });

      ultimosAgendamentos.forEach((apt: any) => {
        const patientKey = patientToKeyMap[apt.paciente_id];
        if (patientKey && !lastConvenios[patientKey] && apt.convenio) {
          lastConvenios[patientKey] = apt.convenio;
        }
      });
    }

    // Consolidar pacientes duplicados
    const pacientesConsolidados = consolidatePatients(pacientesFiltrados, lastConvenios);
    
    console.log(`✅ Consolidação concluída: ${pacientesFiltrados.length} registros → ${pacientesConsolidados.length} pacientes únicos`);
    
    if (pacientesConsolidados.length !== pacientesFiltrados.length) {
      console.log('🔄 Duplicatas detectadas e consolidadas:', {
        antes: pacientesFiltrados.length,
        depois: pacientesConsolidados.length,
        duplicatasRemovidas: pacientesFiltrados.length - pacientesConsolidados.length
      });
    }

    // 🎯 PASSO 3: Buscar agendamentos FUTUROS de TODOS os IDs (incluindo duplicatas)
    // Isso garante que encontramos agendamentos mesmo se estiverem vinculados a duplicatas
    const paciente_ids = pacientesConsolidados.flatMap(p => p.all_ids);
    console.log(`🔍 Buscando agendamentos para ${pacientesConsolidados.length} paciente(s) consolidado(s) (${paciente_ids.length} IDs totais)`, {
      pacientes_unicos: pacientesConsolidados.length,
      ids_totais: paciente_ids.length,
      nomes: pacientesConsolidados.map(p => p.nome_completo)
    });

    const { data: agendamentos, error: agendamentoError } = await supabase
      .from('agendamentos')
      .select(`
        id,
        medico_id,
        data_agendamento,
        hora_agendamento,
        status,
        observacoes,
        pacientes(nome_completo, data_nascimento, celular, convenio),
        medicos(nome, especialidade),
        atendimentos(nome, tipo)
      `)
      .eq('cliente_id', clienteId)
      .in('paciente_id', paciente_ids)
      .in('status', ['agendado', 'confirmado'])
      .gte('data_agendamento', new Date().toISOString().split('T')[0])
      .order('data_agendamento', { ascending: true });

    if (agendamentoError) {
      return errorResponse(`Erro ao buscar agendamentos: ${agendamentoError.message}`);
    }

    // Se não tem agendamentos FUTUROS, informar que existe mas sem consultas futuras
    if (!agendamentos || agendamentos.length === 0) {
      console.log('ℹ️ Paciente existe mas não tem agendamentos futuros');
      return successResponse({
        encontrado: true,
        paciente_cadastrado: true,
        consultas: [],
        message: `Paciente ${pacientesEncontrados[0].nome_completo} está cadastrado(a) no sistema, mas não possui consultas futuras agendadas`,
        observacao: 'Paciente pode agendar nova consulta',
        total: 0
      });
    }

    // 📋 PASSO 3: Montar resposta com agendamentos futuros formatados contextualmente
    const consultas = agendamentos.map((a: any) => {
      const consultaBase = {
        id: a.id,
        paciente_nome: a.pacientes?.nome_completo,
        medico_id: a.medico_id,
        medico_nome: a.medicos?.nome,
        especialidade: a.medicos?.especialidade,
        atendimento_nome: a.atendimentos?.nome,
        data_agendamento: a.data_agendamento,
        hora_agendamento: a.hora_agendamento,
        status: a.status,
        convenio: a.pacientes?.convenio,
        observacoes: a.observacoes
      };
      
      // ✅ Aplicar formatação contextual com regras de negócio (passando config dinâmica)
      return formatarConsultaComContexto(consultaBase, config);
    });

    // Construir mensagem geral com todas as consultas formatadas
    const mensagensConsultas = consultas.map((c, i) => 
      `${i + 1}. ${c.mensagem}`
    ).join('\n\n');

    console.log(`✅ ${consultas.length} consulta(s) futura(s) encontrada(s)`);
    return successResponse({
      encontrado: true,
      message: consultas.length === 1 
        ? consultas[0].mensagem 
        : `${consultas.length} consulta(s) encontrada(s):\n\n${mensagensConsultas}`,
      consultas,
      total: consultas.length
    });

  } catch (error: any) {
    return errorResponse(`Erro ao verificar paciente: ${error?.message || 'Erro desconhecido'}`);
  }
}

// Remarcar consulta
async function handleReschedule(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    console.log('🔄 Iniciando remarcação de consulta');
    console.log('📥 Dados recebidos:', JSON.stringify(body, null, 2));
    console.log('🏥 Cliente ID:', clienteId);
    
    // 🆕 Sanitizar campos opcionais antes de processar
    const { 
      agendamento_id,
      nova_data: novaDataRaw,
      nova_hora: novaHoraRaw,
      observacoes
    } = body;

    const nova_data = sanitizarCampoOpcional(novaDataRaw);
    const nova_hora = sanitizarCampoOpcional(novaHoraRaw);

    // Validação detalhada
    const camposFaltando = [];
    if (!agendamento_id) camposFaltando.push('agendamento_id');
    if (!nova_data) camposFaltando.push('nova_data');
    if (!nova_hora) camposFaltando.push('nova_hora');
    
    if (camposFaltando.length > 0) {
      const erro = `Campos obrigatórios faltando: ${camposFaltando.join(', ')}`;
      console.error('❌ Validação falhou:', erro);
      console.error('📦 Body recebido:', body);
      return errorResponse(erro);
    }
    
    console.log('✅ Validação inicial OK');
    console.log(`📝 Remarcando agendamento ${agendamento_id} para ${nova_data} às ${nova_hora}`);

    // Verificar se agendamento existe COM filtro de cliente
    console.log(`🔍 Buscando agendamento ${agendamento_id}...`);
    const { data: agendamento, error: checkError } = await supabase
      .from('agendamentos')
      .select(`
        id,
        medico_id,
        data_agendamento,
        hora_agendamento,
        status,
        pacientes(nome_completo),
        medicos(nome)
      `)
      .eq('id', agendamento_id)
      .eq('cliente_id', clienteId)
      .single();

    if (checkError) {
      console.error('❌ Erro ao buscar agendamento:', checkError);
      return errorResponse(`Erro ao buscar agendamento: ${checkError.message}`);
    }
    
    if (!agendamento) {
      console.error('❌ Agendamento não encontrado');
      return errorResponse('Agendamento não encontrado');
    }

    console.log('✅ Agendamento encontrado:', {
      paciente: agendamento.pacientes?.nome_completo,
      medico: agendamento.medicos?.nome,
      data_atual: agendamento.data_agendamento,
      hora_atual: agendamento.hora_agendamento,
      status: agendamento.status
    });

    if (agendamento.status === 'cancelado') {
      console.error('❌ Tentativa de remarcar consulta cancelada');
      return errorResponse('Não é possível remarcar consulta cancelada');
    }

    // 🚫 VALIDAR: Nova data/hora não pode ser no passado
    const validacaoDataReschedule = validarDataHoraFutura(nova_data, nova_hora);
    if (!validacaoDataReschedule.valido) {
      const { data: dataAtualBrasil } = getDataHoraAtualBrasil();
      
      return businessErrorResponse({
        codigo_erro: validacaoDataReschedule.erro,
        mensagem_usuario: validacaoDataReschedule.erro === 'DATA_PASSADA' 
          ? `❌ Não é possível remarcar para ${formatarDataPorExtenso(nova_data)} pois essa data já passou.\n\n📅 A data de hoje é ${formatarDataPorExtenso(dataAtualBrasil)}.\n\n💡 Por favor, escolha uma data futura.`
          : `❌ Não é possível remarcar para ${nova_hora} hoje pois esse horário já passou ou está muito próximo.\n\n⏰ Horário mínimo: ${validacaoDataReschedule.horaMinima}\n\n💡 Escolha um horário posterior ou remarque para outro dia.`,
        detalhes: { 
          nova_data,
          nova_hora,
          data_atual: dataAtualBrasil
        }
      });
    }


    // Verificar disponibilidade do novo horário COM filtro de cliente
    console.log(`🔍 Verificando disponibilidade em ${nova_data} às ${nova_hora}...`);
    const { data: conflitos, error: conflitosError } = await supabase
      .from('agendamentos')
      .select('id, pacientes(nome_completo)')
      .eq('medico_id', agendamento.medico_id)
      .eq('data_agendamento', nova_data)
      .eq('hora_agendamento', nova_hora)
      .eq('cliente_id', clienteId)
      .in('status', ['agendado', 'confirmado'])
      .neq('id', agendamento_id);

    if (conflitosError) {
      console.error('❌ Erro ao verificar conflitos:', conflitosError);
    }

    if (conflitos && conflitos.length > 0) {
      console.error('❌ Horário já ocupado:', conflitos[0]);
      return errorResponse(`Horário já ocupado para este médico (${conflitos[0].pacientes?.nome_completo})`);
    }

    console.log('✅ Horário disponível');

    // Atualizar agendamento
    const updateData: any = {
      data_agendamento: nova_data,
      hora_agendamento: nova_hora,
      updated_at: new Date().toISOString()
    };

    if (observacoes) {
      updateData.observacoes = observacoes;
    }

    console.log('💾 Atualizando agendamento:', updateData);

    const { error: updateError } = await supabase
      .from('agendamentos')
      .update(updateData)
      .eq('id', agendamento_id);

    if (updateError) {
      console.error('❌ Erro ao atualizar:', updateError);
      return errorResponse(`Erro ao remarcar: ${updateError.message}`);
    }

    console.log('✅ Agendamento remarcado com sucesso!');

    // Mensagem dinâmica baseada nas business_rules do médico
    let mensagem = `Consulta remarcada com sucesso`;

    // Buscar regras dinâmicas do médico (usar config + hardcoded fallback)
    const regrasRemarcar = getMedicoRules(config, agendamento.medico_id, BUSINESS_RULES.medicos[agendamento.medico_id]);
    console.log(`🔍 [RESCHEDULE] Regras encontradas: ${regrasRemarcar ? 'SIM' : 'NÃO'}, tipo: ${regrasRemarcar?.tipo_agendamento || 'N/A'}`);
    
    if (regrasRemarcar && regrasRemarcar.tipo_agendamento === 'ordem_chegada') {
      const servicos = regrasRemarcar.servicos || {};
      // Buscar primeiro serviço com periodos definidos
      const primeiroServico = Object.values(servicos).find((s: any) => s.periodos && Object.keys(s.periodos).length > 0) as any;
      console.log(`🔍 [RESCHEDULE] Primeiro serviço com períodos: ${primeiroServico ? 'ENCONTRADO' : 'NÃO'}`);
      
      if (primeiroServico?.periodos) {
        const periodos = primeiroServico.periodos;
        const [hora] = nova_hora.split(':').map(Number);
        console.log(`🔍 [RESCHEDULE] Hora: ${hora}, Períodos: manha=${!!periodos.manha}, tarde=${!!periodos.tarde}`);
        
        // Normalizar campos (aceitar inicio/fim OU horario_inicio/horario_fim)
        const manha = periodos.manha;
        const tarde = periodos.tarde;
        
        let periodoConfig: any = null;
        let periodoNome = '';
        
        // Detectar período baseado na hora (usar contagem_inicio/contagem_fim para range amplo)
        if (manha) {
          // Usar contagem_inicio/fim se disponível, senão inicio/fim
          const hIni = parseInt((manha.contagem_inicio || manha.inicio || manha.horario_inicio || '00:00').split(':')[0]);
          const hFim = parseInt((manha.contagem_fim || manha.fim || manha.horario_fim || '12:00').split(':')[0]);
          console.log(`🔍 [RESCHEDULE] Manha range: ${hIni}-${hFim}, hora=${hora}`);
          if (hora >= hIni && hora < hFim) {
            periodoConfig = manha;
            periodoNome = 'manhã';
          }
        }
        if (tarde && !periodoConfig) {
          const hIni = parseInt((tarde.contagem_inicio || tarde.inicio || tarde.horario_inicio || '12:00').split(':')[0]);
          const hFim = parseInt((tarde.contagem_fim || tarde.fim || tarde.horario_fim || '18:00').split(':')[0]);
          console.log(`🔍 [RESCHEDULE] Tarde range: ${hIni}-${hFim}, hora=${hora}`);
          if (hora >= hIni && hora < hFim) {
            periodoConfig = tarde;
            periodoNome = 'tarde';
          }
        }
        
        console.log(`🔍 [RESCHEDULE] Período detectado: ${periodoNome || 'NENHUM'}`);
        
        if (periodoConfig) {
          // Verificar mensagem personalizada do serviço
          if (primeiroServico.mensagem_apos_agendamento) {
            mensagem = `✅ ${primeiroServico.mensagem_apos_agendamento}`;
            console.log(`💬 Usando mensagem personalizada do serviço`);
          } else {
            // Priorizar distribuicao_fichas, fallback para inicio/fim
            const horaInicio = periodoConfig.inicio || periodoConfig.horario_inicio || '';
            const horaFim = periodoConfig.fim || periodoConfig.horario_fim || '';
            const distribuicaoFichas = periodoConfig.distribuicao_fichas || 
              `${horaInicio.substring(0,5)} às ${horaFim.substring(0,5)}`;
            const atendimentoInicio = periodoConfig.atendimento_inicio;
            
            // Formatar data
            const dataFormatadaRemar = new Date(nova_data + 'T00:00:00').toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            });
            
            // Montar mensagem dinâmica
            mensagem = `✅ Consulta remarcada para ${agendamento.pacientes?.nome_completo} em ${dataFormatadaRemar} no período da ${periodoNome} (${distribuicaoFichas})`;
            
            if (atendimentoInicio) {
              mensagem += `. Dr. começa a atender às ${atendimentoInicio}`;
            }
            
            mensagem += `, por ordem de chegada.`;
            console.log(`💬 Mensagem dinâmica ordem_chegada: ${periodoNome} (${distribuicaoFichas})`);
          }
        }
      }
    }

    return successResponse({
      message: mensagem,
      agendamento_id,
      paciente: agendamento.pacientes?.nome_completo,
      medico: agendamento.medicos?.nome,
      data_anterior: agendamento.data_agendamento,
      hora_anterior: agendamento.hora_agendamento,
      nova_data,
      nova_hora,
      validado: true
    });

  } catch (error: any) {
    console.error('💥 Erro inesperado ao remarcar:', error);
    console.error('Stack:', error?.stack);
    return errorResponse(`Erro ao remarcar consulta: ${error?.message || 'Erro desconhecido'}`);
  }
}

// ============= WEBHOOK FILA DE ESPERA =============
async function dispararWebhookFilaEspera(
  supabase: any,
  config: DynamicConfig | null,
  clienteId: string,
  medicoId: string,
  atendimentoId: string,
  notifData: {
    notif_id: string;
    fila_id: string;
    paciente_nome: string;
    paciente_celular: string;
    medico_nome: string;
    atendimento_nome: string;
    data_agendamento: string;
    hora_agendamento: string;
    tempo_limite: string;
  }
): Promise<void> {
  try {
    console.log(`📤 [WEBHOOK-FILA] Disparando webhook para paciente: ${notifData.paciente_nome}`);

    // 1. Determinar tipo de agenda
    let regras = getMedicoRules(config, medicoId, BUSINESS_RULES.medicos[medicoId]);
    
    // Fallback: buscar direto do banco se não encontrou no cache
    if (!regras) {
      try {
        console.log(`🔍 [WEBHOOK-FILA] Regras não encontradas no cache para médico ${medicoId}, buscando no banco...`);
        const { data: brData } = await supabase
          .from('business_rules')
          .select('config')
          .eq('medico_id', medicoId)
          .eq('cliente_id', clienteId)
          .eq('ativo', true)
          .maybeSingle();
        if (brData?.config) {
          regras = brData.config;
          console.log(`✅ [WEBHOOK-FILA] Regras encontradas no banco para médico ${medicoId}`);
        }
      } catch (e) {
        console.warn('⚠️ [WEBHOOK-FILA] Erro ao buscar business_rules fallback:', e?.message);
      }
    }
    
    let tipo_agenda = 'hora_marcada';
    let horario_inicio: string | null = null;
    let horario_fim: string | null = null;

    if (regras) {
      // Determinar dia da semana (0=domingo, 6=sábado)
      const dataObj = new Date(notifData.data_agendamento + 'T12:00:00');
      const diaSemana = dataObj.getDay();
      const diasNomes = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
      const diaNome = diasNomes[diaSemana];

      // Determinar período baseado na hora
      const horaNum = parseInt(notifData.hora_agendamento.split(':')[0], 10);
      const periodoNome = horaNum < 12 ? 'manha' : 'tarde';

      // Buscar serviço e período correspondente
      const servicos = regras.servicos || {};
      let periodoConfig: any = null;
      let servicoConfig: any = null;

      // Tentar encontrar pelo atendimento_nome ou usar o primeiro serviço
      for (const [_nomeServico, sConfig] of Object.entries(servicos) as any[]) {
        if (sConfig?.periodos) {
          for (const [pKey, pConfig] of Object.entries(sConfig.periodos) as any[]) {
            const pKeyNorm = pKey.toLowerCase();
            if (pKeyNorm.includes(diaNome) && pKeyNorm.includes(periodoNome)) {
              periodoConfig = pConfig;
              servicoConfig = sConfig;
              break;
            }
          }
          if (periodoConfig) break;

          // Fallback: buscar pelo dia sem período específico
          for (const [pKey, pConfig] of Object.entries(sConfig.periodos) as any[]) {
            const pKeyNorm = pKey.toLowerCase();
            if (pKeyNorm.includes(diaNome)) {
              periodoConfig = pConfig;
              servicoConfig = sConfig;
              break;
            }
          }
          if (periodoConfig) break;
        }
      }

      // Fallback final: match apenas pelo período (chaves simples como "manha", "tarde")
      if (!periodoConfig) {
        for (const [_nomeServico, sConfig] of Object.entries(servicos) as any[]) {
          if (sConfig?.periodos?.[periodoNome]) {
            periodoConfig = sConfig.periodos[periodoNome];
            servicoConfig = sConfig;
            console.log(`🔍 [WEBHOOK-FILA] Fallback: match por período simples "${periodoNome}"`);
            break;
          }
        }
      }

      // Determinar tipo efetivo
      const tipoEfetivo = getTipoAgendamentoEfetivo(servicoConfig, regras);

      if (tipoEfetivo === 'ordem_chegada') {
        tipo_agenda = 'ordem_chegada';
        if (periodoConfig) {
          horario_inicio = periodoConfig.inicio || periodoConfig.horario_inicio || null;
          horario_fim = periodoConfig.fim || periodoConfig.horario_fim || null;
        }
      } else {
        tipo_agenda = 'hora_marcada';
      }
    }

    // 2. Buscar evolution_instance_name
    let evolution_instance_name: string | null = null;
    try {
      const { data: configRow } = await supabase
        .from('configuracoes_clinica')
        .select('valor')
        .eq('cliente_id', clienteId)
        .eq('chave', 'evolution_instance_name')
        .eq('ativo', true)
        .maybeSingle();
      evolution_instance_name = configRow?.valor || null;
    } catch (e) {
      console.warn('⚠️ [WEBHOOK-FILA] Erro ao buscar evolution_instance_name (ignorado)');
    }

    // 3. Montar payload e disparar
    const payload = {
      notif_id: notifData.notif_id,
      fila_id: notifData.fila_id,
      cliente_id: clienteId,
      paciente_nome: notifData.paciente_nome,
      paciente_celular: notifData.paciente_celular,
      medico_nome: notifData.medico_nome,
      atendimento_nome: notifData.atendimento_nome,
      data_agendamento: notifData.data_agendamento,
      hora_agendamento: notifData.hora_agendamento,
      tempo_limite: notifData.tempo_limite,
      tipo_agenda,
      horario_inicio,
      horario_fim,
      evolution_instance_name
    };

    console.log(`📤 [WEBHOOK-FILA] Payload:`, JSON.stringify(payload));

    const webhookResponse = await fetch(
      'https://n8n-medical.inovaia-automacao.com.br/webhook/fila-espera-notificar',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    console.log(`📤 [WEBHOOK-FILA] Resposta: ${webhookResponse.status} ${webhookResponse.statusText}`);
  } catch (err: any) {
    console.error(`⚠️ [WEBHOOK-FILA] Erro ao disparar webhook (ignorado):`, err?.message);
  }
}

// Cancelar consulta
async function handleCancel(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    const { agendamento_id, motivo } = body;

    if (!agendamento_id) {
      return errorResponse('Campo obrigatório: agendamento_id');
    }

    // Verificar se agendamento existe COM filtro de cliente
    const { data: agendamento, error: checkError } = await supabase
      .from('agendamentos')
      .select(`
        id,
        status,
        data_agendamento,
        hora_agendamento,
        observacoes,
        medico_id,
        atendimento_id,
        pacientes(nome_completo, celular),
        medicos(nome),
        atendimentos(nome)
      `)
      .eq('id', agendamento_id)
      .eq('cliente_id', clienteId)
      .single();

    if (checkError || !agendamento) {
      return errorResponse('Agendamento não encontrado');
    }

    if (agendamento.status === 'cancelado') {
      return errorResponse('Consulta já está cancelada');
    }

    // Cancelar agendamento
    const observacoes_cancelamento = motivo 
      ? `${agendamento.observacoes || ''}\nCancelado via LLM Agent: ${motivo}`.trim()
      : `${agendamento.observacoes || ''}\nCancelado via LLM Agent`.trim();

    const { error: updateError } = await supabase
      .from('agendamentos')
      .update({
        status: 'cancelado',
        observacoes: observacoes_cancelamento,
        updated_at: new Date().toISOString()
      })
      .eq('id', agendamento_id);

    if (updateError) {
      return errorResponse(`Erro ao cancelar: ${updateError.message}`);
    }

    // ============= LER RESULTADO DO TRIGGER PG (FILA DE ESPERA) =============
    // O trigger processar_fila_cancelamento já processou a fila no UPDATE acima.
    // Aqui apenas lemos o resultado para incluir na resposta da API (para n8n/WhatsApp).
    let filaEsperaNotificado: any = null;
    try {
      console.log(`🔍 [FILA-ESPERA] Verificando se trigger PG notificou alguém da fila...`);
      
      const { data: notifCriada, error: notifError } = await supabase
        .from('fila_notificacoes')
        .select(`
          id,
          fila_id,
          data_agendamento,
          hora_agendamento,
          tempo_limite,
          fila_espera!inner(
            id,
            paciente_id,
            medico_id,
            atendimento_id,
            pacientes(nome_completo, celular)
          )
        `)
        .eq('data_agendamento', agendamento.data_agendamento)
        .eq('hora_agendamento', agendamento.hora_agendamento)
        .eq('fila_espera.medico_id', agendamento.medico_id)
        .eq('cliente_id', clienteId)
        .gte('created_at', new Date(Date.now() - 5000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (notifError) {
        console.error('⚠️ [FILA-ESPERA] Erro ao consultar resultado do trigger (ignorado):', notifError.message);
      } else if (notifCriada?.fila_espera) {
        const fe = notifCriada.fila_espera as any;
        console.log(`✅ [FILA-ESPERA] Trigger PG notificou: ${fe.pacientes?.nome_completo} (fila_id: ${notifCriada.fila_id})`);
        
        filaEsperaNotificado = {
          fila_id: notifCriada.fila_id,
          paciente_nome: fe.pacientes?.nome_completo,
          paciente_celular: fe.pacientes?.celular,
          medico_nome: agendamento.medicos?.nome,
          data_disponivel: notifCriada.data_agendamento,
          hora_disponivel: notifCriada.hora_agendamento,
          tempo_limite: notifCriada.tempo_limite,
          atendimento_id: fe.atendimento_id
        };

        // Disparar webhook para n8n (WhatsApp) - nunca bloqueia
        try {
          await dispararWebhookFilaEspera(supabase, config, clienteId, agendamento.medico_id, fe.atendimento_id, {
            notif_id: notifCriada.id,
            fila_id: notifCriada.fila_id,
            paciente_nome: fe.pacientes?.nome_completo,
            paciente_celular: fe.pacientes?.celular,
            medico_nome: agendamento.medicos?.nome,
            atendimento_nome: (agendamento as any).atendimentos?.nome || '',
            data_agendamento: notifCriada.data_agendamento,
            hora_agendamento: notifCriada.hora_agendamento,
            tempo_limite: notifCriada.tempo_limite
          });
        } catch (webhookErr: any) {
          console.error('⚠️ [WEBHOOK-FILA] Erro ao disparar webhook (ignorado):', webhookErr?.message);
        }
      } else {
        console.log('ℹ️ [FILA-ESPERA] Trigger PG não encontrou candidato na fila');
      }
    } catch (filaErr: any) {
      console.error('⚠️ [FILA-ESPERA] Erro ao ler resultado do trigger (ignorado):', filaErr?.message);
      // NUNCA bloqueia — o cancelamento já foi feito com sucesso
    }

    const responseData: any = {
      message: `Consulta cancelada com sucesso`,
      agendamento_id,
      paciente: agendamento.pacientes?.nome_completo,
      medico: agendamento.medicos?.nome,
      data: agendamento.data_agendamento,
      hora: agendamento.hora_agendamento,
      motivo,
      validado: true
    };

    // Adicionar dados da fila se alguém foi notificado
    if (filaEsperaNotificado) {
      responseData.fila_espera_notificado = filaEsperaNotificado;
      responseData.message += `. Paciente da fila de espera notificado: ${filaEsperaNotificado.paciente_nome}`;
    }

    return successResponse(responseData);

  } catch (error: any) {
    return errorResponse(`Erro ao cancelar consulta: ${error?.message || 'Erro desconhecido'}`);
  }
}

// ============= HANDLERS: FILA DE ESPERA INTELIGENTE =============

// Consultar fila de espera
async function handleConsultarFila(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    const { medico_id, atendimento_id, status: statusFiltro } = body;
    
    console.log(`📋 [CONSULTAR-FILA] medico_id=${medico_id}, atendimento_id=${atendimento_id}, status=${statusFiltro || 'aguardando'}`);

    let query = supabase
      .from('fila_espera')
      .select(`
        id,
        status,
        prioridade,
        data_preferida,
        periodo_preferido,
        observacoes,
        tentativas_contato,
        ultimo_contato,
        created_at,
        pacientes(id, nome_completo, celular, convenio, data_nascimento),
        medicos(id, nome, especialidade),
        atendimentos(id, nome, tipo)
      `)
      .eq('cliente_id', clienteId)
      .eq('status', statusFiltro || 'aguardando')
      .order('prioridade', { ascending: false })
      .order('created_at', { ascending: true });

    if (medico_id) {
      query = query.eq('medico_id', medico_id);
    }
    if (atendimento_id) {
      query = query.eq('atendimento_id', atendimento_id);
    }

    const { data: filaItems, error } = await query;

    if (error) {
      console.error('❌ [CONSULTAR-FILA] Erro:', error.message);
      return errorResponse(`Erro ao consultar fila: ${error.message}`);
    }

    console.log(`✅ [CONSULTAR-FILA] ${filaItems?.length || 0} pacientes encontrados`);

    return successResponse({
      message: `Fila de espera: ${filaItems?.length || 0} paciente(s) encontrado(s)`,
      total: filaItems?.length || 0,
      fila: (filaItems || []).map((item: any) => ({
        fila_id: item.id,
        status: item.status,
        prioridade: item.prioridade,
        data_preferida: item.data_preferida,
        periodo_preferido: item.periodo_preferido,
        observacoes: item.observacoes,
        tentativas_contato: item.tentativas_contato,
        ultimo_contato: item.ultimo_contato,
        criado_em: item.created_at,
        paciente: {
          id: item.pacientes?.id,
          nome: item.pacientes?.nome_completo,
          celular: item.pacientes?.celular,
          convenio: item.pacientes?.convenio,
          data_nascimento: item.pacientes?.data_nascimento
        },
        medico: {
          id: item.medicos?.id,
          nome: item.medicos?.nome,
          especialidade: item.medicos?.especialidade
        },
        atendimento: {
          id: item.atendimentos?.id,
          nome: item.atendimentos?.nome,
          tipo: item.atendimentos?.tipo
        }
      }))
    });

  } catch (error: any) {
    return errorResponse(`Erro ao consultar fila: ${error?.message || 'Erro desconhecido'}`);
  }
}

// Adicionar paciente à fila de espera
async function handleAdicionarFila(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    // Normalização: aceita snake_case (padrão) e camelCase (retrocompatibilidade)
    const nomeCompleto = body.nome_completo || body.nomeCompleto;
    const dataNascimento = body.data_nascimento || body.dataNascimento;
    const convenio = body.convenio;
    const celular = body.celular;
    let medicoId = body.medico_id || body.medicoId;
    let atendimentoId = body.atendimento_id || body.atendimentoId;
    const medicoNome = body.medico_nome || body.medicoNome;
    const atendimentoNome = body.atendimento_nome || body.atendimentoNome;
    const dataPreferida = body.data_preferida || body.dataPreferida;
    const periodoPreferido = body.periodo_preferido || body.periodoPreferido;
    const observacoes = body.observacoes;
    const prioridade = body.prioridade;

    // Validações — aceita UUID ou nome para médico e atendimento
    if (!nomeCompleto || (!medicoId && !medicoNome) || (!atendimentoId && !atendimentoNome) || !dataPreferida) {
      return errorResponse('Campos obrigatórios: nome_completo, (medico_id ou medico_nome), (atendimento_id ou atendimento_nome), data_preferida');
    }

    // ============= RESOLVER MÉDICO POR NOME (se não veio UUID) =============
    let medicoNomeResolvido = '';
    if (!medicoId && medicoNome) {
      console.log(`🔍 [ADICIONAR-FILA] Resolvendo médico por nome: "${medicoNome}"`);
      const { data: todosMedicos, error: medicosError } = await supabase
        .from('medicos')
        .select('id, nome')
        .eq('cliente_id', clienteId)
        .eq('ativo', true);

      if (medicosError || !todosMedicos || todosMedicos.length === 0) {
        return errorResponse('Erro ao buscar médicos ou nenhum médico ativo encontrado');
      }

      const normalizarNomeFuzzy = (texto: string): string =>
        texto.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[.,\-']/g, '')
          .replace(/\s+/g, ' ')
          .trim();

      const nomeNorm = normalizarNomeFuzzy(medicoNome);
      const medicosEncontrados = todosMedicos.filter((m: any) => {
        const nomeComplNorm = normalizarNomeFuzzy(m.nome);
        return nomeComplNorm.includes(nomeNorm) || nomeNorm.includes(nomeComplNorm);
      });

      if (medicosEncontrados.length === 0) {
        const sugestoes = todosMedicos.map((m: any) => m.nome).slice(0, 10);
        return errorResponse(`Médico "${medicoNome}" não encontrado. Disponíveis: ${sugestoes.join(', ')}`);
      }

      medicoId = medicosEncontrados[0].id;
      medicoNomeResolvido = medicosEncontrados[0].nome;
      console.log(`✅ [ADICIONAR-FILA] Médico resolvido: "${medicoNome}" → "${medicoNomeResolvido}" (${medicoId})`);
    }

    // ============= RESOLVER ATENDIMENTO POR NOME (se não veio UUID) =============
    let atendimentoNomeResolvido = '';
    if (!atendimentoId && atendimentoNome) {
      console.log(`🔍 [ADICIONAR-FILA] Resolvendo atendimento por nome: "${atendimentoNome}"`);
      const { data: atendimentos, error: atendError } = await supabase
        .from('atendimentos')
        .select('id, nome')
        .eq('cliente_id', clienteId)
        .eq('medico_id', medicoId)
        .eq('ativo', true)
        .ilike('nome', `%${atendimentoNome}%`);

      if (atendError || !atendimentos || atendimentos.length === 0) {
        // Buscar lista de serviços disponíveis para sugerir
        const { data: servicosDisponiveis } = await supabase
          .from('atendimentos')
          .select('nome')
          .eq('cliente_id', clienteId)
          .eq('medico_id', medicoId)
          .eq('ativo', true);
        const sugestoes = servicosDisponiveis?.map((s: any) => s.nome) || [];
        return errorResponse(`Atendimento "${atendimentoNome}" não encontrado para este médico. Disponíveis: ${sugestoes.join(', ')}`);
      }

      atendimentoId = atendimentos[0].id;
      atendimentoNomeResolvido = atendimentos[0].nome;
      console.log(`✅ [ADICIONAR-FILA] Atendimento resolvido: "${atendimentoNome}" → "${atendimentoNomeResolvido}" (${atendimentoId})`);
    }

    console.log(`📥 [ADICIONAR-FILA] Paciente: ${nomeCompleto}, Médico: ${medicoId}, Atendimento: ${atendimentoId}`);

    // ============= RESOLVER PACIENTE_ID =============
    // Mesmo padrão do handleSchedule: buscar por nome + data_nascimento + celular
    const nomeNormalizado = nomeCompleto.toUpperCase().trim();
    let pacienteId: string | null = null;

    // Buscar paciente existente
    let queryPaciente = supabase
      .from('pacientes')
      .select('id, nome_completo, celular, data_nascimento')
      .eq('cliente_id', clienteId)
      .eq('nome_completo', nomeNormalizado);
    
    if (dataNascimento) {
      queryPaciente = queryPaciente.eq('data_nascimento', dataNascimento);
    }

    const { data: pacientesExistentes, error: searchError } = await queryPaciente;

    if (searchError) {
      console.error('⚠️ [ADICIONAR-FILA] Erro ao buscar paciente:', searchError.message);
    }

    if (pacientesExistentes && pacientesExistentes.length > 0) {
      // Paciente encontrado — usar o primeiro match
      pacienteId = pacientesExistentes[0].id;
      console.log(`✅ [ADICIONAR-FILA] Paciente existente: ${pacienteId}`);
    } else {
      // Criar novo paciente
      console.log(`🆕 [ADICIONAR-FILA] Criando novo paciente: ${nomeNormalizado}`);
      const { data: novoPaciente, error: createError } = await supabase
        .from('pacientes')
        .insert({
          cliente_id: clienteId,
          nome_completo: nomeNormalizado,
          data_nascimento: dataNascimento || null,
          convenio: formatarConvenioParaBanco(convenio || 'PARTICULAR'),
          celular: celular || '',
        })
        .select('id')
        .single();

      if (createError) {
        return errorResponse(`Erro ao criar paciente: ${createError.message}`);
      }
      pacienteId = novoPaciente.id;
      console.log(`✅ [ADICIONAR-FILA] Novo paciente criado: ${pacienteId}`);
    }

    // Verificar se já está na fila para o mesmo médico/atendimento
    const { data: jaExiste, error: checkError } = await supabase
      .from('fila_espera')
      .select('id, status')
      .eq('cliente_id', clienteId)
      .eq('paciente_id', pacienteId)
      .eq('medico_id', medicoId)
      .eq('atendimento_id', atendimentoId)
      .in('status', ['aguardando', 'notificado'])
      .maybeSingle();

    if (jaExiste) {
      return errorResponse(`Paciente ${nomeNormalizado} já está na fila de espera para este médico/atendimento (status: ${jaExiste.status})`);
    }

    // Inserir na fila de espera
    const { data: novaFila, error: insertError } = await supabase
      .from('fila_espera')
      .insert({
        cliente_id: clienteId,
        paciente_id: pacienteId,
        medico_id: medicoId,
        atendimento_id: atendimentoId,
        data_preferida: dataPreferida,
        periodo_preferido: periodoPreferido || 'qualquer',
        observacoes: observacoes || null,
        prioridade: prioridade || 1,
        status: 'aguardando'
      })
      .select('id')
      .single();

    if (insertError) {
      return errorResponse(`Erro ao adicionar na fila: ${insertError.message}`);
    }

    console.log(`✅ [ADICIONAR-FILA] Paciente adicionado à fila: ${novaFila.id}`);

    return successResponse({
      message: `Paciente ${nomeNormalizado} adicionado à fila de espera com sucesso`,
      fila_id: novaFila.id,
      paciente_id: pacienteId,
      paciente_nome: nomeNormalizado,
      medico_id: medicoId,
      medico_nome: medicoNomeResolvido || medicoNome || medicoId,
      atendimento_id: atendimentoId,
      atendimento_nome: atendimentoNomeResolvido || atendimentoNome || atendimentoId,
      data_preferida: dataPreferida,
      periodo_preferido: periodoPreferido || 'qualquer',
      prioridade: prioridade || 1,
      status: 'aguardando'
    });

  } catch (error: any) {
    return errorResponse(`Erro ao adicionar à fila: ${error?.message || 'Erro desconhecido'}`);
  }
}

// Responder fila de espera (paciente aceita ou recusa a vaga)
async function handleResponderFila(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    const { fila_id, notif_id, resposta, data_agendamento, hora_agendamento } = body;

    if (!fila_id || !notif_id || !resposta) {
      return errorResponse('Campos obrigatórios: fila_id, notif_id, resposta (SIM/NAO)');
    }

    const respostaNormalizada = resposta.toUpperCase().trim();
    console.log(`📥 [RESPONDER-FILA] fila_id=${fila_id}, notif_id=${notif_id}, resposta=${respostaNormalizada}`);

    // ============= LOCK POR NOTIF_ID =============
    // Buscar notificação específica e validar antes de processar
    const { data: notif, error: notifErr } = await supabase
      .from('fila_notificacoes')
      .select('id, fila_id, tempo_limite, resposta_paciente, status_envio')
      .eq('id', notif_id)
      .single();

    if (notifErr || !notif) {
      return errorResponse('Notificação não encontrada');
    }

    if (notif.fila_id !== fila_id) {
      return errorResponse('notif_id não pertence a este fila_id');
    }

    // Verificar se o tempo expirou
    if (new Date(notif.tempo_limite).getTime() < Date.now()) {
      return errorResponse('Tempo da vaga expirou. Aguarde a próxima oportunidade.');
    }

    // Verificar concorrência: já respondida por outra tentativa
    if (notif.resposta_paciente !== 'sem_resposta' || notif.status_envio !== 'pendente') {
      return errorResponse('Esta vaga já foi processada (respondida/expirada).');
    }

    // Buscar dados da fila
    const { data: filaItem, error: filaError } = await supabase
      .from('fila_espera')
      .select(`
        id, status, paciente_id, medico_id, atendimento_id,
        pacientes(id, nome_completo, celular, data_nascimento, convenio),
        medicos(id, nome),
        atendimentos(id, nome)
      `)
      .eq('id', fila_id)
      .eq('cliente_id', clienteId)
      .single();

    if (filaError || !filaItem) {
      return errorResponse('Item da fila não encontrado');
    }

    if (filaItem.status !== 'notificado') {
      return errorResponse(`Status atual da fila é "${filaItem.status}", esperado "notificado"`);
    }

    // ============= RESPOSTA SIM =============
    if (respostaNormalizada === 'SIM') {
      if (!data_agendamento || !hora_agendamento) {
        return errorResponse('Para aceitar a vaga, informe: data_agendamento e hora_agendamento');
      }

      console.log(`✅ [RESPONDER-FILA] Paciente ACEITOU. Agendando via RPC atômica...`);

      // Usar RPC criar_agendamento_atomico_externo (garante validação de conflito + atomicidade)
      const { data: result, error: agendamentoError } = await supabase
        .rpc('criar_agendamento_atomico_externo', {
          p_cliente_id: clienteId,
          p_nome_completo: filaItem.pacientes?.nome_completo?.toUpperCase(),
          p_data_nascimento: filaItem.pacientes?.data_nascimento,
          p_convenio: filaItem.pacientes?.convenio || 'PARTICULAR',
          p_telefone: null,
          p_celular: filaItem.pacientes?.celular || '',
          p_medico_id: filaItem.medico_id,
          p_atendimento_id: filaItem.atendimento_id,
          p_data_agendamento: data_agendamento,
          p_hora_agendamento: hora_agendamento,
          p_observacoes: 'AGENDAMENTO VIA FILA DE ESPERA - WHATSAPP',
          p_criado_por: 'Fila de Espera WhatsApp',
          p_force_conflict: false
        });

      if (agendamentoError) {
        console.error('❌ [RESPONDER-FILA] Erro na RPC:', agendamentoError.message);
        return errorResponse(`Erro ao agendar: ${agendamentoError.message}`);
      }

      if (!result?.success) {
        console.error('❌ [RESPONDER-FILA] RPC retornou erro:', result);
        return errorResponse(`Não foi possível agendar: ${result?.message || 'Horário pode estar ocupado'}`);
      }

      // Atualizar fila para 'agendado'
      await supabase
        .from('fila_espera')
        .update({ 
          status: 'agendado',
          agendamento_id: result.agendamento_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', fila_id);

      // Atualizar notificação
      await supabase
        .from('fila_notificacoes')
        .update({ 
          resposta_paciente: 'aceito',
          status_envio: 'respondido'
        })
        .eq('id', notif_id)
        .eq('resposta_paciente', 'sem_resposta');

      console.log(`✅ [RESPONDER-FILA] Agendamento criado: ${result.agendamento_id}`);

      return successResponse({
        message: `Vaga confirmada! Agendamento criado para ${filaItem.pacientes?.nome_completo}`,
        agendamento_id: result.agendamento_id,
        paciente: filaItem.pacientes?.nome_completo,
        medico: filaItem.medicos?.nome,
        data: data_agendamento,
        hora: hora_agendamento,
        fila_id,
        acao: 'agendado'
      });
    }

    // ============= RESPOSTA NÃO / TIMEOUT =============
    if (respostaNormalizada === 'NAO' || respostaNormalizada === 'NÃO' || respostaNormalizada === 'TIMEOUT') {
      console.log(`❌ [RESPONDER-FILA] Paciente RECUSOU/TIMEOUT. Buscando próximo da fila...`);

      // Voltar status da fila para 'aguardando'
      await supabase
        .from('fila_espera')
        .update({ 
          status: 'aguardando',
          tentativas_contato: (filaItem.tentativas_contato || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', fila_id);

      // Atualizar notificação
      const respostaNotif = respostaNormalizada === 'TIMEOUT' ? 'sem_resposta' : 'recusado';
      await supabase
        .from('fila_notificacoes')
        .update({ 
          resposta_paciente: respostaNotif,
          status_envio: 'respondido'
        })
        .eq('id', notif_id)
        .eq('resposta_paciente', 'sem_resposta');

      // ============= BUSCAR PRÓXIMO CANDIDATO (CASCATA) =============
      let proximoNotificado: any = null;
      try {
        const { data: proximoCandidato, error: proxError } = await supabase
          .from('fila_espera')
          .select(`
            id, paciente_id,
            pacientes(nome_completo, celular)
          `)
          .eq('medico_id', filaItem.medico_id)
          .eq('atendimento_id', filaItem.atendimento_id)
          .eq('status', 'aguardando')
          .eq('cliente_id', clienteId)
          .neq('id', fila_id) // Excluir o que acabou de recusar
          .order('prioridade', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (proxError) {
          console.error('⚠️ [RESPONDER-FILA] Erro ao buscar próximo (ignorado):', proxError.message);
        } else if (proximoCandidato && data_agendamento && hora_agendamento) {
          console.log(`🔄 [RESPONDER-FILA] Próximo candidato: ${proximoCandidato.pacientes?.nome_completo}`);

          // Atualizar próximo para 'notificado'
          await supabase
            .from('fila_espera')
            .update({ 
              status: 'notificado',
              ultimo_contato: new Date().toISOString(),
              tentativas_contato: 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', proximoCandidato.id);

          // Criar notificação para o próximo
          const tempoLimite = new Date();
          tempoLimite.setHours(tempoLimite.getHours() + 2);

          const { data: notifNova, error: notifInsertErr } = await supabase
            .from('fila_notificacoes')
            .insert({
              fila_id: proximoCandidato.id,
              cliente_id: clienteId,
              data_agendamento,
              hora_agendamento,
              horario_disponivel: new Date().toISOString(),
              tempo_limite: tempoLimite.toISOString(),
              status_envio: 'pendente',
              resposta_paciente: 'sem_resposta',
              canal_notificacao: 'whatsapp'
            })
            .select('id')
            .single();

          if (notifInsertErr) {
            console.error('⚠️ [RESPONDER-FILA] Erro ao inserir notificação cascata:', notifInsertErr.message);
          }

          proximoNotificado = {
            fila_id: proximoCandidato.id,
            notif_id: notifNova?.id || '',
            paciente_nome: proximoCandidato.pacientes?.nome_completo,
            paciente_celular: proximoCandidato.pacientes?.celular,
            data_disponivel: data_agendamento,
            hora_disponivel: hora_agendamento,
            tempo_limite: tempoLimite.toISOString()
          };

          // Disparar webhook para n8n (WhatsApp) - nunca bloqueia
          try {
            await dispararWebhookFilaEspera(supabase, config, clienteId, filaItem.medico_id, filaItem.atendimento_id, {
              notif_id: notifNova?.id || '',
              fila_id: proximoCandidato.id,
              paciente_nome: proximoCandidato.pacientes?.nome_completo,
              paciente_celular: proximoCandidato.pacientes?.celular,
              medico_nome: filaItem.medicos?.nome,
              atendimento_nome: filaItem.atendimentos?.nome || '',
              data_agendamento,
              hora_agendamento,
              tempo_limite: tempoLimite.toISOString()
            });
          } catch (webhookErr: any) {
            console.error('⚠️ [WEBHOOK-FILA] Erro ao disparar webhook cascata (ignorado):', webhookErr?.message);
          }

          console.log(`📱 [RESPONDER-FILA] Próximo notificado: ${proximoNotificado.paciente_nome}`);
        } else {
          console.log('ℹ️ [RESPONDER-FILA] Nenhum próximo candidato na fila');
        }
      } catch (cascataErr: any) {
        console.error('⚠️ [RESPONDER-FILA] Erro na cascata (ignorado):', cascataErr?.message);
      }

      const responseData: any = {
        message: `Resposta registrada: ${respostaNormalizada}`,
        fila_id,
        paciente: filaItem.pacientes?.nome_completo,
        acao: respostaNormalizada === 'TIMEOUT' ? 'timeout' : 'recusado'
      };

      if (proximoNotificado) {
        responseData.proximo_notificado = proximoNotificado;
        responseData.message += `. Próximo paciente da fila notificado: ${proximoNotificado.paciente_nome}`;
      } else {
        responseData.message += `. Nenhum outro paciente na fila.`;
      }

      return successResponse(responseData);
    }

    return errorResponse('Resposta inválida. Use: SIM, NAO ou TIMEOUT');

  } catch (error: any) {
    return errorResponse(`Erro ao processar resposta da fila: ${error?.message || 'Erro desconhecido'}`);
  }
}

// Confirmar consulta
async function handleConfirm(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    const { agendamento_id, observacoes } = body;

    // Validação
    if (!agendamento_id) {
      return errorResponse('Campo obrigatório: agendamento_id');
    }

    // Buscar agendamento
    const { data: agendamento, error: checkError } = await supabase
      .from('agendamentos')
      .select(`
        id,
        status,
        data_agendamento,
        hora_agendamento,
        observacoes,
        medico_id,
        pacientes(nome_completo, celular),
        medicos(nome)
      `)
      .eq('id', agendamento_id)
      .eq('cliente_id', clienteId)
      .single();

    if (checkError || !agendamento) {
      return errorResponse('Agendamento não encontrado');
    }

    // Validar status atual
    if (agendamento.status === 'cancelado') {
      return errorResponse('Não é possível confirmar consulta cancelada');
    }

    if (agendamento.status === 'confirmado') {
      return successResponse({
        message: 'Consulta já está confirmada',
        agendamento_id,
        paciente: agendamento.pacientes?.nome_completo,
        medico: agendamento.medicos?.nome,
        data: agendamento.data_agendamento,
        hora: agendamento.hora_agendamento,
        already_confirmed: true,
        validado: true
      });
    }

    if (agendamento.status === 'realizado') {
      return errorResponse('Consulta já foi realizada');
    }

    // Validar se a data não passou
    const dataAgendamento = new Date(agendamento.data_agendamento + 'T' + agendamento.hora_agendamento);
    const agora = new Date();
    
    if (dataAgendamento < agora) {
      return errorResponse('Não é possível confirmar consulta que já passou');
    }

    // Preparar observações
    const observacoes_confirmacao = observacoes 
      ? `${agendamento.observacoes || ''}\nConfirmado via LLM Agent: ${observacoes}`.trim()
      : `${agendamento.observacoes || ''}\nConfirmado via LLM Agent WhatsApp`.trim();

    // Atualizar para confirmado
    const { error: updateError } = await supabase
      .from('agendamentos')
      .update({
        status: 'confirmado',
        observacoes: observacoes_confirmacao,
        confirmado_em: new Date().toISOString(),
        confirmado_por: 'whatsapp_automatico',
        updated_at: new Date().toISOString()
      })
      .eq('id', agendamento_id);

    if (updateError) {
      return errorResponse(`Erro ao confirmar: ${updateError.message}`);
    }

    console.log(`✅ Agendamento ${agendamento_id} confirmado com sucesso`);

    // Mensagem dinâmica baseada nas business_rules do médico
    let mensagemConfirmacao = 'Consulta confirmada com sucesso';
    
    // Buscar regras dinâmicas do médico (usar config + hardcoded fallback)
    const regrasConfirmar = getMedicoRules(config, agendamento.medico_id, BUSINESS_RULES.medicos[agendamento.medico_id]);
    console.log(`🔍 [CONFIRM] Regras encontradas: ${regrasConfirmar ? 'SIM' : 'NÃO'}, tipo: ${regrasConfirmar?.tipo_agendamento || 'N/A'}`);
    
    if (regrasConfirmar && regrasConfirmar.tipo_agendamento === 'ordem_chegada') {
      const servicosConf = regrasConfirmar.servicos || {};
      // Buscar primeiro serviço com periodos definidos
      const primeiroServicoConf = Object.values(servicosConf).find((s: any) => s.periodos && Object.keys(s.periodos).length > 0) as any;
      console.log(`🔍 [CONFIRM] Primeiro serviço com períodos: ${primeiroServicoConf ? 'ENCONTRADO' : 'NÃO'}`);
      
      if (primeiroServicoConf?.periodos) {
        const periodosConf = primeiroServicoConf.periodos;
        const [horaConf] = agendamento.hora_agendamento.split(':').map(Number);
        console.log(`🔍 [CONFIRM] Hora: ${horaConf}, Períodos: manha=${!!periodosConf.manha}, tarde=${!!periodosConf.tarde}`);
        
        let periodoConfigConf: any = null;
        let periodoNomeConf = '';
        
        // Detectar período (usar contagem_inicio/fim para range amplo)
        const manhaConf = periodosConf.manha;
        const tardeConf = periodosConf.tarde;
        
        if (manhaConf) {
          const hIniConf = parseInt((manhaConf.contagem_inicio || manhaConf.inicio || manhaConf.horario_inicio || '00:00').split(':')[0]);
          const hFimConf = parseInt((manhaConf.contagem_fim || manhaConf.fim || manhaConf.horario_fim || '12:00').split(':')[0]);
          console.log(`🔍 [CONFIRM] Manha range: ${hIniConf}-${hFimConf}, hora=${horaConf}`);
          if (horaConf >= hIniConf && horaConf < hFimConf) {
            periodoConfigConf = manhaConf;
            periodoNomeConf = 'manhã';
          }
        }
        if (tardeConf && !periodoConfigConf) {
          const hIniConf = parseInt((tardeConf.contagem_inicio || tardeConf.inicio || tardeConf.horario_inicio || '12:00').split(':')[0]);
          const hFimConf = parseInt((tardeConf.contagem_fim || tardeConf.fim || tardeConf.horario_fim || '18:00').split(':')[0]);
          console.log(`🔍 [CONFIRM] Tarde range: ${hIniConf}-${hFimConf}, hora=${horaConf}`);
          if (horaConf >= hIniConf && horaConf < hFimConf) {
            periodoConfigConf = tardeConf;
            periodoNomeConf = 'tarde';
          }
        }
        
        console.log(`🔍 [CONFIRM] Período detectado: ${periodoNomeConf || 'NENHUM'}`);
        
        if (periodoConfigConf) {
          const horaInicioConf = periodoConfigConf.inicio || periodoConfigConf.horario_inicio || '';
          const horaFimConf = periodoConfigConf.fim || periodoConfigConf.horario_fim || '';
          const distribuicaoFichasConf = periodoConfigConf.distribuicao_fichas || 
            `${horaInicioConf.substring(0,5)} às ${horaFimConf.substring(0,5)}`;
          const atendimentoInicioConf = periodoConfigConf.atendimento_inicio;
          
          const dataFormatadaConf = new Date(agendamento.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
          
          mensagemConfirmacao = `✅ Consulta confirmada para ${dataFormatadaConf} no período da ${periodoNomeConf} (${distribuicaoFichasConf})`;
          
          if (atendimentoInicioConf) {
            mensagemConfirmacao += `. Dr. começa a atender às ${atendimentoInicioConf}`;
          }
          
          mensagemConfirmacao += `, por ordem de chegada.`;
          console.log(`💬 Confirmação com período: ${periodoNomeConf} (${distribuicaoFichasConf})`);
        }
      }
    }

    return successResponse({
      message: mensagemConfirmacao,
      agendamento_id,
      paciente: agendamento.pacientes?.nome_completo,
      celular: agendamento.pacientes?.celular,
      medico: agendamento.medicos?.nome,
      data: agendamento.data_agendamento,
      hora: agendamento.hora_agendamento,
      status: 'confirmado',
      confirmado_em: new Date().toISOString(),
      validado: true
    });

  } catch (error) {
    console.error('❌ Erro ao confirmar agendamento:', error);
    return errorResponse(`Erro ao confirmar: ${error?.message || 'Erro desconhecido'}`);
  }
}

// Verificar disponibilidade de horários
async function handleAvailability(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    console.log('📅 [RAW] Dados recebidos do N8N:', JSON.stringify(body, null, 2));
    
    // 🛡️ SANITIZAÇÃO AUTOMÁTICA: Remover "=" do início dos valores (problema comum do N8N)
    const sanitizeValue = (value: any): any => {
      if (typeof value === 'string' && value.startsWith('=')) {
        const cleaned = value.substring(1);
        console.log(`🧹 Sanitizado: "${value}" → "${cleaned}"`);
        return cleaned;
      }
      return value;
    };
    
    let { medico_nome, medico_id, data_consulta, atendimento_nome, dias_busca = 14, mensagem_original, buscar_proximas = false, quantidade_dias = 7 } = body;
    
    // 🆕 SANITIZAÇÃO ROBUSTA: Converter valores inválidos em undefined
    data_consulta = sanitizarCampoOpcional(data_consulta);
    medico_nome = sanitizarCampoOpcional(medico_nome);
    medico_id = sanitizarCampoOpcional(medico_id);
    atendimento_nome = sanitizarCampoOpcional(atendimento_nome);
    
    // 🆕 DETECTAR PERÍODO SOLICITADO: Extrair período da mensagem original
    let periodo_solicitado = null;
    if (mensagem_original) {
      const msg = mensagem_original.toLowerCase();
      if (msg.includes('manhã') || msg.includes('manha')) {
        periodo_solicitado = 'manha';
      } else if (msg.includes('tarde')) {
        periodo_solicitado = 'tarde';
      } else if (msg.includes('noite')) {
        periodo_solicitado = 'noite';
      }
    }
    console.log(`🕐 Período solicitado pelo usuário: ${periodo_solicitado || 'não especificado'}`);
    
    // 🆕 DETECÇÃO DE DADOS INVERTIDOS: Verificar se medico_nome contém data ou se data_consulta contém nome
    if (data_consulta && typeof data_consulta === 'string') {
      // Se data_consulta contém "|" ou nome de médico, está invertido
      if (data_consulta.includes('|') || /[a-zA-Z]{3,}/.test(data_consulta)) {
        console.warn('⚠️ DADOS INVERTIDOS DETECTADOS! Tentando corrigir...');
        console.log('Antes:', { medico_nome, atendimento_nome, data_consulta });
        
        // Tentar extrair informações do campo invertido
        const partes = data_consulta.split('|');
        if (partes.length === 2) {
          // Formato: "Dra Adriana|05/01/2026"
          const possivelMedico = partes[0].trim();
          const possivelData = partes[1].trim();
          
          // Realocar corretamente
          if (!medico_nome || medico_nome === 'Consulta') {
            medico_nome = possivelMedico;
          }
          
          // Converter data DD/MM/YYYY para YYYY-MM-DD
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(possivelData)) {
            const [dia, mes, ano] = possivelData.split('/');
            data_consulta = `${ano}-${mes}-${dia}`;
          }
        }
        
        console.log('Depois:', { medico_nome, atendimento_nome, data_consulta });
      }
    }
    
    // 🆕 CONVERTER FORMATO DE DATA: DD/MM/YYYY → YYYY-MM-DD
    if (data_consulta && /^\d{2}\/\d{2}\/\d{4}$/.test(data_consulta)) {
      const [dia, mes, ano] = data_consulta.split('/');
      data_consulta = `${ano}-${mes}-${dia}`;
      console.log(`📅 Data convertida: DD/MM/YYYY → YYYY-MM-DD: ${data_consulta}`);
    }
    
    // 📅 VALIDAÇÃO DE FORMATO
    if (data_consulta) {
      // Validar formato YYYY-MM-DD (após conversão)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data_consulta)) {
        return businessErrorResponse({
          codigo_erro: 'FORMATO_DATA_INVALIDO',
          mensagem_usuario: `❌ Formato de data inválido: "${data_consulta}"\n\n✅ Formatos aceitos:\n   • YYYY-MM-DD (ex: 2026-01-20)\n   • DD/MM/YYYY (ex: 20/01/2026)\n\n💡 Por favor, informe a data no formato correto.`,
          detalhes: {
            data_informada: data_consulta,
            formatos_aceitos: ['YYYY-MM-DD', 'DD/MM/YYYY']
          }
        });
      }
    }
    
    // ✅ LÓGICA INTELIGENTE: Se for noite, buscar a partir de AMANHÃ
    const { data: dataAtual, hora: horaAtual, horarioEmMinutos: horarioAtualEmMinutos } = getDataHoraAtualBrasil();

    // Variáveis para controle de migração e data original
    let mensagemEspecial = null;
    let data_consulta_original = data_consulta;

    if (!data_consulta) {
      // Se for depois das 18h, começar a busca de AMANHÃ
      if (horaAtual >= 18) {
        const amanha = new Date(dataAtual + 'T00:00:00');
        amanha.setDate(amanha.getDate() + 1);
        data_consulta = amanha.toISOString().split('T')[0];
        console.log(`🌙 Horário noturno (${horaAtual}h). Buscando a partir de AMANHÃ: ${data_consulta}`);
      } else {
        data_consulta = dataAtual;
        console.log(`📅 Buscando a partir de HOJE: ${data_consulta} (${horaAtual}h)`);
      }
    } else {
      // Verificar se está no passado (comparar com data de São Paulo)
      const dataConsulta = new Date(data_consulta + 'T00:00:00');
      const hoje = new Date(dataAtual + 'T00:00:00');
      
      
      // Calcular diferença em dias entre data solicitada e hoje
      const diferencaDias = Math.floor((hoje.getTime() - dataConsulta.getTime()) / (1000 * 60 * 60 * 24));
      
      // 🚫 CORREÇÃO: Bloquear TODAS as datas passadas (não apenas >90 dias)
      if (dataConsulta < hoje) {
        console.log(`🚫 Data solicitada (${data_consulta}) está no passado (${diferencaDias} dias). Ajustando...`);
        
        // Se for horário noturno, começar de amanhã
        if (horaAtual >= 18) {
          const amanha = new Date(dataAtual + 'T00:00:00');
          amanha.setDate(amanha.getDate() + 1);
          data_consulta = amanha.toISOString().split('T')[0];
          console.log(`🌙 Horário noturno (${horaAtual}h). Buscando a partir de AMANHÃ: ${data_consulta}`);
        } else {
          data_consulta = dataAtual;
          console.log(`📅 Ajustado para HOJE: ${data_consulta}`);
        }
      } else {
        console.log(`📅 Ponto de partida da busca: ${data_consulta} (data futura fornecida pelo usuário)`);
      }
    }
    
    console.log('✅ [SANITIZADO] Dados processados:', { 
      medico_nome, 
      medico_id, 
      data_consulta, 
      atendimento_nome, 
      dias_busca 
    });
    
    // 💬 LOGGING: Mensagem original do paciente (se fornecida)
    if (mensagem_original) {
      console.log('💬 Mensagem original do paciente:', mensagem_original);
    }
    
    // ✅ Validar campos obrigatórios
    if (!atendimento_nome || atendimento_nome.trim() === '') {
      return businessErrorResponse({
        codigo_erro: 'CAMPO_OBRIGATORIO',
        mensagem_usuario: '❌ É necessário informar o tipo de atendimento.\n\n📋 Exemplos:\n   • Consulta Cardiológica\n   • Colonoscopia\n   • Endoscopia\n\n💡 Informe o nome do exame ou consulta desejada.',
        detalhes: {
          campo_faltando: 'atendimento_nome'
        }
      });
    }
    
    if (!medico_nome && !medico_id) {
      return businessErrorResponse({
        codigo_erro: 'CAMPO_OBRIGATORIO',
        mensagem_usuario: '❌ É necessário informar o médico.\n\n📋 Você pode informar:\n   • Nome do médico (medico_nome)\n   • ID do médico (medico_id)\n\n💡 Escolha qual médico deseja consultar.',
        detalhes: {
          campo_faltando: 'medico_nome ou medico_id'
        }
      });
    }
    
    // 🔍 Buscar médico COM busca inteligente (aceita nomes parciais) - MOVIDO PARA ANTES DE USAR
    let medico;
    if (medico_id) {
      // Busca por ID (exata)
      const { data, error } = await supabase
        .from('medicos')
        .select('id, nome, ativo, crm, rqe')
        .eq('id', medico_id)
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .single();
      
      medico = data;
      if (error || !medico) {
        console.error(`❌ Médico ID não encontrado: ${medico_id}`, error);
        return businessErrorResponse({
          codigo_erro: 'MEDICO_NAO_ENCONTRADO',
          mensagem_usuario: `❌ Médico com ID "${medico_id}" não foi encontrado ou está inativo.\n\n💡 Verifique se o código do médico está correto.`,
          detalhes: { medico_id }
        });
      }
      console.log(`✅ Médico encontrado por ID: ${medico.nome}`);
      
    } else {
      // 🔍 BUSCA SUPER INTELIGENTE POR NOME:
      console.log(`🔍 Buscando médico: "${medico_nome}"`);
      
      // Buscar TODOS os médicos ativos
      const { data: todosMedicos, error } = await supabase
        .from('medicos')
        .select('id, nome, ativo, crm, rqe')
        .eq('cliente_id', clienteId)
        .eq('ativo', true);
      
      if (error) {
        console.error('❌ Erro ao buscar médicos:', error);
        return businessErrorResponse({
          codigo_erro: 'ERRO_BUSCA_MEDICOS',
          mensagem_usuario: '❌ Não foi possível buscar os médicos disponíveis no momento.\n\n📞 Por favor, tente novamente em alguns instantes ou entre em contato com a clínica.',
          detalhes: { erro_tecnico: error.message }
        });
      }
      
      if (!todosMedicos || todosMedicos.length === 0) {
        return businessErrorResponse({
          codigo_erro: 'NENHUM_MEDICO_ATIVO',
          mensagem_usuario: '❌ Não há médicos ativos cadastrados no sistema no momento.\n\n📞 Por favor, entre em contato com a clínica para mais informações.',
          detalhes: {}
        });
      }
      
      // Matching inteligente com fuzzy fallback
      console.log(`🔍 Buscando médico: "${medico_nome}"`);
      const medicosEncontrados = fuzzyMatchMedicos(medico_nome, todosMedicos);
      
      if (medicosEncontrados.length === 0) {
        console.error(`❌ Nenhum médico encontrado para: "${medico_nome}"`);
        const sugestoes = todosMedicos.map(m => m.nome).slice(0, 10);
        return businessErrorResponse({
          codigo_erro: 'MEDICO_NAO_ENCONTRADO',
          mensagem_usuario: `❌ Médico "${medico_nome}" não encontrado.\n\n✅ Médicos disponíveis:\n${sugestoes.map(m => `   • ${m}`).join('\n')}\n\n💡 Escolha um dos médicos disponíveis acima.`,
          detalhes: {
            medico_solicitado: medico_nome,
            medicos_disponiveis: sugestoes
          }
        });
      }
      
      if (medicosEncontrados.length > 1) {
        console.warn(`⚠️ Múltiplos médicos encontrados para "${medico_nome}":`, 
          medicosEncontrados.map(m => m.nome).join(', '));
      }
      
      medico = medicosEncontrados[0];
      console.log(`✅ Médico encontrado: "${medico_nome}" → "${medico.nome}"`);
    }
    
    // 🆕 VERIFICAR AGENDA DEDICADA PARA O SERVIÇO
    // Se o serviço solicitado tem uma agenda virtual separada (ex: "Teste Ergométrico - Dr. Marcelo"), usar ela
    if (atendimento_nome && medico) {
      const agendaDedicada = await buscarAgendaDedicada(
        supabase, 
        clienteId, 
        medico.nome, 
        atendimento_nome
      );
      
      if (agendaDedicada) {
        console.log(`🔄 [REDIRECIONAR] Usando agenda dedicada "${agendaDedicada.nome}" (ID: ${agendaDedicada.id}) ao invés de "${medico.nome}"`);
        
        // Atualizar medico para a agenda dedicada
        // A agenda dedicada contém todas as configurações necessárias
        medico = {
          id: agendaDedicada.id,
          nome: agendaDedicada.nome,
          ativo: true
        };
      }
    }
    
    // 🔍 BUSCAR REGRAS DE NEGÓCIO E CONFIGURAÇÃO DO SERVIÇO (declarar uma única vez)
    let regras = getMedicoRules(config, medico.id, BUSINESS_RULES.medicos[medico.id]);
    
    // Normalizar nome do atendimento para matching (remover espaços, underscores, acentos)
    const normalizarParaMatch = (texto: string) => 
      texto.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[_\s-]+/g, '') // Remove underscores, espaços e hífens
        .trim();
    
    const atendimentoNormalizado = normalizarParaMatch(atendimento_nome);
    
    // 🔍 MATCHING MELHORADO: Priorizar match exato antes de parcial
    const servicosKeys = Object.keys(regras?.servicos || {});
    
    // 1. Primeiro tentar match exato
    let servicoKey = servicosKeys.find(s => {
      const keyNormalizada = normalizarParaMatch(s);
      const nomeServico = regras?.servicos[s]?.nome;
      const nomeNormalizado = nomeServico ? normalizarParaMatch(nomeServico) : '';
      
      // Match exato (prioridade alta)
      return keyNormalizada === atendimentoNormalizado ||
             nomeNormalizado === atendimentoNormalizado;
    });
    
    // 2. Se não encontrou exato, tentar match parcial (mas preferir o que mais se aproxima)
    if (!servicoKey) {
      // Ordenar por similaridade: quem tiver mais caracteres em comum vence
      const matchesParciais = servicosKeys.map(s => {
        const keyNormalizada = normalizarParaMatch(s);
        const nomeServico = regras?.servicos[s]?.nome;
        const nomeNormalizado = nomeServico ? normalizarParaMatch(nomeServico) : '';
        
        // Calcular score: match exato = 100, contains = tamanho do match
        let score = 0;
        if (keyNormalizada.includes(atendimentoNormalizado)) score = atendimentoNormalizado.length;
        if (atendimentoNormalizado.includes(keyNormalizada)) score = Math.max(score, keyNormalizada.length);
        if (nomeNormalizado.includes(atendimentoNormalizado)) score = Math.max(score, atendimentoNormalizado.length);
        if (atendimentoNormalizado.includes(nomeNormalizado) && nomeNormalizado) score = Math.max(score, nomeNormalizado.length);
        
        return { key: s, score };
      }).filter(m => m.score > 0).sort((a, b) => b.score - a.score);
      
      if (matchesParciais.length > 0) {
        servicoKey = matchesParciais[0].key;
        console.log(`🔍 Match parcial selecionado: "${servicoKey}" (score: ${matchesParciais[0].score})`);
      }
    }
    let servico = servicoKey ? normalizarServicoPeriodos(regras.servicos[servicoKey]) : null;
    
    // 🔄 FALLBACK: Se serviço não encontrado e médico é ordem_chegada, usar períodos de qualquer serviço configurado
    if (!servico && regras?.tipo_agendamento === 'ordem_chegada' && regras?.servicos) {
      const primeiroServicoComPeriodos = Object.values(regras.servicos)
        .find((s: any) => s?.periodos && Object.keys(s.periodos).length > 0);
      
      if (primeiroServicoComPeriodos) {
        servico = normalizarServicoPeriodos(primeiroServicoComPeriodos as any);
        console.log(`🔄 [FALLBACK] Serviço "${atendimento_nome}" não encontrado. Usando períodos de outro serviço configurado para ordem de chegada.`);
      }
    }
    
    // Não retornar erro ainda - busca melhorada será feita depois se necessário
    
    const tipoAtendimento = servico?.tipo || regras?.tipo_agendamento || 'ordem_chegada';
    console.log(`📋 [${medico.nome}] Tipo: ${tipoAtendimento} | Serviço: ${servicoKey || 'não encontrado ainda'} (busca: "${atendimento_nome}")`);
    if (servicoKey && servico) {
      console.log(`📋 [SERVICO] compartilha_limite_com: ${servico.compartilha_limite_com || 'N/A'}, limite_proprio: ${servico.limite_proprio || 'N/A'}`);
    }
    
    // 🧠 ANÁLISE DE CONTEXTO: Usar mensagem original para inferir intenção
    let isPerguntaAberta = false;
    let periodoPreferido: 'manha' | 'tarde' | null = null;
    let diaPreferido: number | null = null; // 1=seg, 2=ter, 3=qua, 4=qui, 5=sex
    
    // 🆕 CONTEXTO PARA DATA INVÁLIDA (usado quando dia da semana não é permitido)
    let dataInvalidaOriginal: string | null = null;
    let diaNomeInvalido: string | null = null;
    
    if (mensagem_original) {
      const mensagemLower = mensagem_original.toLowerCase();
      
      // 🆕 RECONHECER SINÔNIMOS DE AGENDAMENTO
      const sinonimosAgendamento = [
        'retorno', 'remarcar', 'reagendar', 'voltar', 'retornar',
        'nova consulta', 'outra consulta', 'consulta de novo',
        'marcar de novo', 'segunda vez', 'consulta de volta'
      ];
      
      const ehSinonimo = sinonimosAgendamento.some(sin => mensagemLower.includes(sin));
      
      // Detectar se é pergunta aberta ("quando tem vaga?")
      isPerguntaAberta = 
        ehSinonimo ||  // 🆕 Incluir sinônimos
        mensagemLower.includes('quando') ||
        mensagemLower.includes('próxima') ||
        mensagemLower.includes('proxima') ||
        mensagemLower.includes('disponível') ||
        mensagemLower.includes('disponivel');
      
      if (ehSinonimo) {
        console.log('🔄 Sinônimo de agendamento detectado:', mensagem_original);
      }
      
      // 🆕 DETECTAR PERÍODO PREFERIDO
      if (mensagemLower.includes('tarde') || mensagemLower.includes('tade')) {
        periodoPreferido = 'tarde';
        console.log('🌙 Paciente solicitou especificamente período da TARDE');
      } else if (mensagemLower.includes('manhã') || mensagemLower.includes('manha')) {
        periodoPreferido = 'manha';
        console.log('☀️ Paciente solicitou especificamente período da MANHÃ');
      }
      
      // 🆕 DETECTAR DIA DA SEMANA PREFERIDO
      const diasMap: Record<string, number> = {
        'segunda': 1, 'seg': 1, 'segunda-feira': 1, 'segundafeira': 1,
        'terça': 2, 'terca': 2, 'ter': 2, 'terça-feira': 2, 'tercafeira': 2,
        'quarta': 3, 'qua': 3, 'quarta-feira': 3, 'quartafeira': 3,
        'quinta': 4, 'qui': 4, 'quinta-feira': 4, 'quintafeira': 4,
        'sexta': 5, 'sex': 5, 'sexta-feira': 5, 'sextafeira': 5
      };

      for (const [nome, numero] of Object.entries(diasMap)) {
        if (mensagemLower.includes(nome)) {
          diaPreferido = numero;
          console.log(`📅 Dia da semana específico detectado: ${nome} (${numero})`);
          break;
        }
      }

      if (diaPreferido) {
        console.log(`🗓️ Dia preferido: ${diaPreferido}. Filtrando apenas esse dia da semana.`);
      }
      
      // 🆕 EXTRAIR REFERÊNCIA A MÊS na mensagem original
      let mesEspecifico: string | null = null;
      const mesesMap: Record<string, string> = {
        'janeiro': '01', 'jan': '01',
        'fevereiro': '02', 'fev': '02',
        'março': '03', 'mar': '03', 'marco': '03',
        'abril': '04', 'abr': '04',
        'maio': '05', 'mai': '05',
        'junho': '06', 'jun': '06',
        'julho': '07', 'jul': '07',
        'agosto': '08', 'ago': '08',
        'setembro': '09', 'set': '09',
        'outubro': '10', 'out': '10',
        'novembro': '11', 'nov': '11',
        'dezembro': '12', 'dez': '12'
      };
      
      for (const [nome, numero] of Object.entries(mesesMap)) {
        if (mensagemLower.includes(nome)) {
          mesEspecifico = numero;
          console.log(`📆 Mês específico detectado na mensagem: ${nome} (${numero})`);
          
          // Se data_consulta não foi fornecida mas mês foi mencionado, construir primeira data do mês
          if (!data_consulta) {
            const anoAtual = new Date().getFullYear();
            const mesAtual = new Date().getMonth() + 1;
            const anoAlvo = parseInt(numero) < mesAtual ? anoAtual + 1 : anoAtual;
            data_consulta = `${anoAlvo}-${numero}-01`;
            console.log(`🗓️ Construída data inicial do mês: ${data_consulta}`);
          }
          break;
        }
      }
      
      // Só anular data_consulta se for pergunta REALMENTE aberta (sem contexto de mês/data)
      if (isPerguntaAberta && !data_consulta && !mesEspecifico) {
        console.log('🔍 Pergunta aberta sem data específica detectada. Buscando próximas disponibilidades a partir de hoje.');
        // data_consulta permanece null, usará hoje como base
      } else if (data_consulta) {
        console.log(`📅 Data específica fornecida: ${data_consulta}. Respeitando como ponto de partida da busca.`);
        // data_consulta mantida, será usada como dataInicial
      }

      if (periodoPreferido) {
        console.log(`⏰ Período preferido detectado: ${periodoPreferido}. Mantendo compatibilidade com data fornecida.`);
        // Não anular data_consulta - período + data são compatíveis
      }
    }
    
    // 🆕 AJUSTAR QUANTIDADE DE DIAS quando houver período específico
    if (periodoPreferido && quantidade_dias < 14) {
      quantidade_dias = 14; // Buscar mais dias para encontrar o período correto
      console.log(`🔍 Ampliando busca para ${quantidade_dias} dias devido ao período específico: ${periodoPreferido}`);
    }
    
    // 🆕 AMPLIAR também quando houver dia específico
    if (diaPreferido && quantidade_dias < 21) {
      quantidade_dias = 21; // 3 semanas para garantir 3 ocorrências do dia
      console.log(`🔍 Ampliando busca para ${quantidade_dias} dias devido ao dia específico`);
    }
    
    // 🆕 BUSCAR PRÓXIMAS DATAS DISPONÍVEIS (quando buscar_proximas = true ou sem data específica)
    if (buscar_proximas || (!data_consulta && mensagem_original)) {
      console.log(`🔍 Buscando próximas ${quantidade_dias} datas disponíveis...`);
      if (periodoPreferido) console.log(`  → Filtro: período ${periodoPreferido}`);
      if (diaPreferido) console.log(`  → Filtro: dia da semana ${diaPreferido}`);
      
      const proximasDatas: Array<{
        data: string;
        dia_semana: string;
        periodos: Array<{
          periodo: string;
          horario_distribuicao: string;
          vagas_disponiveis: number;
          limite_total: number;
          tipo: string;
        }>;
      }> = [];
      
      // Se data_consulta foi fornecida, usar como ponto de partida
      // Caso contrário, usar data atual
      const { data: dataAtualBrasil } = getDataHoraAtualBrasil();
      const dataInicial = data_consulta || dataAtualBrasil;

      console.log(`📅 Ponto de partida da busca: ${dataInicial} ${data_consulta ? '(fornecida pelo usuário)' : '(data atual)'}`);
      
      // 🆕 VERIFICAR ORDEM_CHEGADA_CONFIG: Se médico tem config especial para ordem de chegada
      const ordemChegadaConfig = regras?.ordem_chegada_config;
      if (ordemChegadaConfig) {
        console.log('🎫 [ORDEM_CHEGADA_CONFIG] Config especial detectada:', ordemChegadaConfig);
      }
      
      // 🎫 LÓGICA PARA ORDEM DE CHEGADA (todos os médicos)
      console.log('🎫 Buscando períodos disponíveis (ordem de chegada)...');
      
      for (let diasAdiantados = 0; diasAdiantados <= quantidade_dias; diasAdiantados++) {
        const dataCheck = new Date(dataInicial + 'T00:00:00');
        dataCheck.setDate(dataCheck.getDate() + diasAdiantados);
        const dataCheckStr = dataCheck.toISOString().split('T')[0];
        const diaSemanaNum = dataCheck.getDay();
        
        // Pular finais de semana
        if (diaSemanaNum === 0 || diaSemanaNum === 6) continue;
        
        // 🗓️ Filtrar por dia da semana preferido
        if (diaPreferido && diaSemanaNum !== diaPreferido) {
          continue; // Pular dias que não correspondem ao preferido
        }
        
        // Verificar se dia permitido pelo serviço
        if (servico?.dias_semana && !servico.dias_semana.includes(diaSemanaNum)) {
          continue;
        }
        
        // 🆕 VERIFICAR LIMITES COMPARTILHADOS PARA SERVIÇOS ESPECIAIS
        if (servicoKey && servico && (servico.compartilha_limite_com || servico.limite_proprio)) {
          const vagasComLimites = await calcularVagasDisponiveisComLimites(
            supabase,
            clienteId,
            medico.id,
            dataCheckStr,
            servicoKey,
            servico,
            regras
          );
          
          if (vagasComLimites <= 0) {
            console.log(`⏭️ Pulando ${dataCheckStr} - limites compartilhados/sublimite atingidos`);
            continue;
          }
          
          // Se passou na verificação de limites, adicionar com as vagas calculadas
          const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
          proximasDatas.push({
            data: dataCheckStr,
            dia_semana: diasSemana[diaSemanaNum],
            periodos: [{
              periodo: 'Manhã', // Ligadura é manhã
              horario_distribuicao: '07:00 às 12:00',
              vagas_disponiveis: vagasComLimites,
              limite_total: servico.limite_proprio || 1,
              tipo: servico.tipo_agendamento || 'hora_marcada'
            }]
          });
          
          const datasNecessarias = periodoPreferido ? 5 : 3;
          if (proximasDatas.length >= datasNecessarias) break;
          continue; // Pular lógica padrão de períodos
        }
        
        const periodosDisponiveis = [];
        
      // ☀️ VERIFICAR MANHÃ (pular se paciente quer apenas tarde)
      if (servico?.periodos?.manha && periodoPreferido !== 'tarde') {
          const manha = servico.periodos.manha;
          const diaPermitido = !manha.dias_especificos || manha.dias_especificos.includes(diaSemanaNum);
          
          if (diaPermitido) {
            const { data: agendados } = await supabase
              .from('agendamentos')
              .select('id')
              .eq('medico_id', medico.id)
              .eq('data_agendamento', dataCheckStr)
              .eq('cliente_id', clienteId)
              .gte('hora_agendamento', manha.inicio)
              .lte('hora_agendamento', manha.fim)
              .gte('data_agendamento', getMinimumBookingDate(config))
              .is('excluido_em', null)
              .in('status', ['agendado', 'confirmado']);
            
            const ocupadas = agendados?.length || 0;
            const disponiveis = manha.limite - ocupadas;
            
            if (disponiveis > 0) {
              // 🆕 USAR ordem_chegada_config se disponível
              const horarioDistribuicao = ordemChegadaConfig 
                ? `${ordemChegadaConfig.hora_chegada_inicio} às ${ordemChegadaConfig.hora_chegada_fim}` 
                : (manha.distribuicao_fichas || `${manha.inicio} às ${manha.fim}`);
              
              periodosDisponiveis.push({
                periodo: 'Manhã',
                horario_distribuicao: horarioDistribuicao,
                vagas_disponiveis: disponiveis,
                limite_total: manha.limite,
                tipo: regras?.tipo_agendamento || 'ordem_chegada',
                mensagem_ordem_chegada: ordemChegadaConfig?.mensagem || null,
                hora_atendimento_inicio: ordemChegadaConfig?.hora_atendimento_inicio || null
              });
            }
          }
        }
        
      // 🌙 VERIFICAR TARDE (pular se paciente quer apenas manhã)
      if (servico?.periodos?.tarde && periodoPreferido !== 'manha') {
          const tarde = servico.periodos.tarde;
          const diaPermitido = !tarde.dias_especificos || tarde.dias_especificos.includes(diaSemanaNum);
          
          if (diaPermitido) {
            const { data: agendados } = await supabase
              .from('agendamentos')
              .select('id')
              .eq('medico_id', medico.id)
              .eq('data_agendamento', dataCheckStr)
              .eq('cliente_id', clienteId)
              .gte('hora_agendamento', tarde.inicio)
              .lte('hora_agendamento', tarde.fim)
              .gte('data_agendamento', getMinimumBookingDate(config))
              .is('excluido_em', null)
              .in('status', ['agendado', 'confirmado']);
            
            const ocupadas = agendados?.length || 0;
            const disponiveis = tarde.limite - ocupadas;
            
            if (disponiveis > 0) {
              // 🆕 USAR ordem_chegada_config se disponível
              const horarioDistribuicao = ordemChegadaConfig 
                ? `${ordemChegadaConfig.hora_chegada_inicio} às ${ordemChegadaConfig.hora_chegada_fim}` 
                : (tarde.distribuicao_fichas || `${tarde.inicio} às ${tarde.fim}`);
              
              periodosDisponiveis.push({
                periodo: 'Tarde',
                horario_distribuicao: horarioDistribuicao,
                vagas_disponiveis: disponiveis,
                limite_total: tarde.limite,
                tipo: regras?.tipo_agendamento || 'ordem_chegada',
                mensagem_ordem_chegada: ordemChegadaConfig?.mensagem || null,
                hora_atendimento_inicio: ordemChegadaConfig?.hora_atendimento_inicio || null
              });
            }
          }
        }
        
        // Adicionar data se tiver períodos disponíveis
        if (periodosDisponiveis.length > 0) {
          const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
          proximasDatas.push({
            data: dataCheckStr,
            dia_semana: diasSemana[diaSemanaNum],
            periodos: periodosDisponiveis
          });
        }
        
        // Encontrar datas suficientes (mais quando há período específico)
        const datasNecessarias = periodoPreferido ? 5 : 3;
        if (proximasDatas.length >= datasNecessarias) break;
      }
      
      // 🔄 RETRY AUTOMÁTICO: Se não encontrou vagas e ainda não buscou 100 dias, ampliar
      if (proximasDatas.length === 0 && quantidade_dias < 100) {
        console.log(`⚠️ Nenhuma data encontrada em ${quantidade_dias} dias. Ampliando busca para 100 dias...`);
        quantidade_dias = 100;
        
        // 🔁 REPETIR O LOOP DE BUSCA com 45 dias
        for (let diasAdiantados = 0; diasAdiantados <= quantidade_dias; diasAdiantados++) {
          const dataCheck = new Date(dataInicial + 'T00:00:00');
          dataCheck.setDate(dataCheck.getDate() + diasAdiantados);
          const dataCheckStr = dataCheck.toISOString().split('T')[0];
          const diaSemanaNum = dataCheck.getDay();
          
          // Pular finais de semana
          if (diaSemanaNum === 0 || diaSemanaNum === 6) continue;
          
          // 🗓️ Filtrar por dia da semana preferido
          if (diaPreferido && diaSemanaNum !== diaPreferido) {
            continue; // Pular dias que não correspondem ao preferido
          }
          
          // 🔒 Verificar bloqueios
          const { data: bloqueiosData } = await supabase
            .from('bloqueios_agenda')
            .select('id')
            .eq('medico_id', medico.id)
            .lte('data_inicio', dataCheckStr)
            .gte('data_fim', dataCheckStr)
            .eq('status', 'ativo')
            .eq('cliente_id', clienteId);
          
          if (bloqueiosData && bloqueiosData.length > 0) {
            console.log(`⏭️ Pulando ${dataCheckStr} (bloqueada)`);
            continue;
          }
          
          // Contar agendamentos para este dia
          const { count: totalAgendamentos } = await supabase
            .from('agendamentos')
            .select('*', { count: 'exact', head: true })
            .eq('medico_id', medico.id)
            .eq('data_agendamento', dataCheckStr)
            .neq('status', 'cancelado')
            .eq('cliente_id', clienteId);
          
          const periodosDisponiveis = [];
          
          for (const [periodo, config] of Object.entries(servico?.periodos || {})) {
            if (periodoPreferido && periodo !== periodoPreferido) continue;
            
            const limite = (config as any).limite || 9;
            const { count: agendadosPeriodo } = await supabase
              .from('agendamentos')
              .select('*', { count: 'exact', head: true })
              .eq('medico_id', medico.id)
              .eq('data_agendamento', dataCheckStr)
              .gte('hora_agendamento', (config as any).inicio)
              .lt('hora_agendamento', (config as any).fim)
              .neq('status', 'cancelado')
              .eq('cliente_id', clienteId);
            
            const vagasDisponiveis = limite - (agendadosPeriodo || 0);
            
            if (vagasDisponiveis > 0) {
              periodosDisponiveis.push({
                periodo: periodo.charAt(0).toUpperCase() + periodo.slice(1),
                horario_distribuicao: (config as any).distribuicao_fichas || `${(config as any).inicio} às ${(config as any).fim}`,
                vagas_disponiveis: vagasDisponiveis,
                limite_total: limite,
                tipo: tipoAtendimento
              });
            }
          }
          
          if (periodosDisponiveis.length > 0) {
            const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
            proximasDatas.push({
              data: dataCheckStr,
              dia_semana: diasSemana[diaSemanaNum],
              periodos: periodosDisponiveis
            });
            
            const datasNecessarias = periodoPreferido ? 5 : 3;
            if (proximasDatas.length >= datasNecessarias) break;
          }
        }
        
        console.log(`📊 Após ampliação: ${proximasDatas.length} datas encontradas`);
      }
      
      // 🚫 SE AINDA NÃO ENCONTROU NADA, retornar erro claro
      if (proximasDatas.length === 0) {
        const mensagemSemVagas = 
          `😔 Não encontrei vagas disponíveis para ${medico.nome} nos próximos ${quantidade_dias} dias.\n\n` +
          `📞 Por favor, ligue para ${getClinicPhone(config)} para:\n` +
          `• Entrar na fila de espera\n` +
          `• Verificar outras opções\n` +
          `• Consultar disponibilidade futura`;
        
        console.log(`❌ Nenhuma data disponível mesmo após buscar ${quantidade_dias} dias`);
        
        return successResponse({
          message: mensagemSemVagas,
          medico: medico.nome,
          medico_id: medico.id,
          tipo_atendimento: tipoAtendimento,
          proximas_datas: [],
          sem_vagas: true,  // 🆕 FLAG
          contexto: {
            medico_id: medico.id,
            medico_nome: medico.nome,
            servico: atendimento_nome,
            periodo_solicitado: periodoPreferido,
            dias_buscados: 45
          }
        });
      }
      
      return successResponse({
        message: mensagemEspecial || `${proximasDatas.length} datas disponíveis encontradas`,
        medico: medico.nome,
        medico_id: medico.id,
        tipo_atendimento: 'ordem_chegada',
        proximas_datas: proximasDatas,
        data_solicitada: data_consulta_original || data_consulta,
        contexto: {
          medico_id: medico.id,
          medico_nome: medico.nome,
          servico: atendimento_nome,
          ultima_data_sugerida: proximasDatas[proximasDatas.length - 1]?.data
        }
      });
    }
    
    // Nota: Detecção de pergunta aberta e sinônimos já foi feita acima (linhas 1240-1265)

    // Buscar regras de negócio (reutilizar se já existe)
    console.log(`🔍 Buscando regras para médico ID: ${medico.id}, Nome: ${medico.nome}`);
    if (!regras) regras = getMedicoRules(config, medico.id, BUSINESS_RULES.medicos[medico.id]);
    if (!regras) {
      console.error(`❌ Regras não encontradas para médico ${medico.nome} (ID: ${medico.id})`);
      console.error(`📋 IDs disponíveis nas BUSINESS_RULES:`, Object.keys(BUSINESS_RULES.medicos));
      return businessErrorResponse({
        codigo_erro: 'REGRAS_NAO_CONFIGURADAS',
        mensagem_usuario: `❌ Não foi possível verificar disponibilidade para ${medico.nome}.\n\n📞 Por favor, entre em contato com a clínica para agendar: ${getClinicPhone(config)}`,
        detalhes: {
          medico_id: medico.id,
          medico_nome: medico.nome
        }
      });
    }
    console.log(`✅ Regras encontradas para ${(regras as any)?.nome || medico.nome}`);

    // Buscar serviço nas regras com matching inteligente MELHORADO (só se ainda não encontrado)
    if (!servicoKey) {
      const servicoKeyMelhorado = Object.keys(regras.servicos || {}).find(s => {
      const servicoLower = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove acentos
      const atendimentoLower = atendimento_nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      // 🆕 Função auxiliar para normalizar removendo plurais e palavras comuns
      const normalizarParaMatch = (texto: string): string[] => {
        // Remove plurais (s no final) e divide em palavras
        const semPlural = texto.replace(/s\s*$/i, '');
        const palavras = semPlural.split(/\s+/).filter(p => p.length > 2); // Ignora palavras muito curtas
        return [texto, semPlural, ...palavras]; // Retorna original, sem plural, e palavras individuais
      };
      
      const servicoVariacoes = normalizarParaMatch(servicoLower);
      const atendimentoVariacoes = normalizarParaMatch(atendimentoLower);
      
      // Match exato (sem acentos)
      if (servicoLower === atendimentoLower) return true;
      
      // Match bidirecional (contém) com variações
      for (const sv of servicoVariacoes) {
        for (const av of atendimentoVariacoes) {
          if (sv.includes(av) || av.includes(sv)) {
            return true;
          }
        }
      }
      
      // 🆕 MELHORADO: Match por keywords com variações de grafia
      const keywords: Record<string, string[]> = {
        'consulta': ['consultas', 'agendamento', 'atendimento'], // Variações de "consulta"
        'endocrinologica': ['endocrino', 'endocrinologia', 'endocrinologista', 'consulta endocrino', 'consulta endocrinologista'],
        'cardiologica': ['cardio', 'cardiologia', 'cardiologista', 'consulta cardio', 'consulta cardiologista'],
        'ergometrico': ['ergo', 'ergometrico', 'teste ergo'],
        'ecocardiograma': ['eco', 'ecocardio'],
        'ultrassom': ['ultra', 'ultrassonografia']
      };
      
      for (const [base, aliases] of Object.entries(keywords)) {
        if (servicoLower.includes(base)) {
          // Verifica se alguma variação do atendimento bate com a base ou aliases
          const matchBase = atendimentoVariacoes.some(av => av.includes(base) || base.includes(av));
          const matchAliases = aliases.some(alias => 
            atendimentoVariacoes.some(av => av.includes(alias) || alias.includes(av))
          );
          if (matchBase || matchAliases) return true;
        }
      }
      
      return false;
    });
    
    // Se encontrou um match melhorado, atualizar servicoKey
    if (servicoKeyMelhorado) {
      servicoKey = servicoKeyMelhorado;
    }
  }
    
    // Logs de debug para matching
    if (servicoKey) {
      console.log(`✅ Match encontrado: "${atendimento_nome}" → "${servicoKey}"`);
    } else {
      console.error(`❌ ERRO: Serviço não encontrado: "${atendimento_nome}"`);
      console.error(`📋 Serviços disponíveis para ${medico.nome}:`, Object.keys(regras.servicos || {}));
      console.error(`🔍 Tentando match com:`, { 
        atendimento_normalizado: atendimento_nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
        servicos_normalizados: Object.keys(regras.servicos || {}).map(s => ({
          original: s,
          normalizado: s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        }))
      });
      const servicosDisponiveis = Object.keys(regras.servicos || {}).join(', ');
      return businessErrorResponse({
        codigo_erro: 'SERVICO_NAO_ENCONTRADO',
        mensagem_usuario: `❌ O serviço "${atendimento_nome}" não está disponível para ${medico.nome}.\n\n✅ Serviços disponíveis:\n${Object.keys(regras.servicos || {}).map(s => `   • ${s}`).join('\n')}\n\n💡 Por favor, escolha um dos serviços listados acima.`,
        detalhes: {
          servico_solicitado: atendimento_nome,
          servicos_disponiveis: Object.keys(regras.servicos || {})
        }
      });
    }

    // Reutilizar/atualizar variável servico já declarada
    if (!servico && servicoKey) {
      servico = regras.servicos[servicoKey];
      console.log(`✅ Serviço encontrado na busca melhorada: ${servicoKey}`);
    }
    
    // Validar se encontrou o serviço
    if (!servico || !servicoKey) {
      console.error(`❌ ERRO FINAL: Serviço não encontrado após todas as tentativas`);
      return businessErrorResponse({
        codigo_erro: 'SERVICO_NAO_ENCONTRADO',
        mensagem_usuario: `❌ O serviço "${atendimento_nome}" não está disponível para ${medico.nome}.\n\n✅ Serviços disponíveis:\n${Object.keys(regras.servicos || {}).map(s => `   • ${s}`).join('\n')}\n\n💡 Por favor, escolha um dos serviços listados acima.`,
        detalhes: {
          servico_solicitado: atendimento_nome,
          servicos_disponiveis: Object.keys(regras.servicos || {})
        }
      });
    }

    // Verificar se permite agendamento online (aceita ambos os formatos)
    // Para agendas dedicadas, verificar também no nível raiz das regras
    const permiteOnlineCheck = 
      servico.permite_online || 
      servico.permite_agendamento_online ||
      regras?.permite_agendamento_online ||  // Nível raiz das regras (agendas dedicadas)
      (regras as any)?.config?.permite_agendamento_online;  // Fallback para config nested
    if (!permiteOnlineCheck) {
      console.log(`ℹ️ Serviço ${servicoKey} não permite agendamento online`);
      
      // 1. Tentar mensagem personalizada do banco (llm_mensagens) - prioridade mais alta
      const mensagemDinamica = getMensagemPersonalizada(config, 'servico_nao_agendavel', medico.id);
      
      // 2. Fallback para mensagem do business_rules (servico.mensagem)
      // 3. Fallback para mensagem genérica
      const mensagemFinal = mensagemDinamica 
        || servico.mensagem 
        || 'Este serviço não pode ser agendado online. Por favor, entre em contato com a clínica.';
      
      console.log(`📝 Mensagem servico_nao_agendavel: ${mensagemDinamica ? 'dinâmica do banco' : servico.mensagem ? 'do business_rules' : 'genérica'}`);
      
      return successResponse({
        permite_online: false,
        medico: medico.nome,
        servico: servicoKey,
        message: mensagemFinal
      });
    }

    // 🎯 DECLARAR VARIÁVEIS DE DIA DA SEMANA (usadas em vários lugares)
    const diasNomes = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    let diaSemana: number | null = null;
    
    // 🎯 VALIDAÇÃO DE DIA DA SEMANA (apenas se data_consulta foi fornecida)
    if (data_consulta) {
      diaSemana = getDiaSemana(data_consulta);
      
      console.log(`📅 Validação: Data ${data_consulta} = ${diasNomes[diaSemana]} (${diaSemana})`);
      console.log(`📋 Dias permitidos para ${servicoKey}: ${servico.dias_semana?.map((d: number) => diasNomes[d]).join(', ') || 'todos'}`);
      
      if (servico.dias_semana && !servico.dias_semana.includes(diaSemana)) {
        const diasPermitidos = servico.dias_semana.map((d: number) => diasNomes[d]).join(', ');
        
        console.log(`⚠️ Data inválida detectada! ${diasNomes[diaSemana]} não está em [${diasPermitidos}]`);
        console.log(`🔄 Redirecionando para busca automática de próximas datas...`);
        
        // 🎯 SALVAR CONTEXTO DA DATA INVÁLIDA
        dataInvalidaOriginal = data_consulta;
        diaNomeInvalido = diasNomes[diaSemana];
        
        // 🔄 REDIRECIONAR PARA BUSCA AUTOMÁTICA
        // Limpar data_consulta para acionar o fluxo de busca de próximas datas
        data_consulta = undefined as any;
        buscar_proximas = true;
        
        console.log(`✅ Redirecionamento configurado: buscar_proximas=true, data_consulta=undefined`);
        console.log(`🔁 O código agora entrará no bloco de busca de próximas datas...`);
      } else {
        console.log(`✅ Validação de dia da semana passou: ${diasNomes[diaSemana]} está permitido`);
      }
    }

    // 🆕 SE NÃO FOI FORNECIDA DATA ESPECÍFICA, BUSCAR PRÓXIMAS DATAS DISPONÍVEIS
    if (!data_consulta) {
      const tipoAtendimento = servico.tipo || regras.tipo_agendamento || 'ordem_chegada';
      const proximasDatas = [];
      
      // 🎯 Se usuário pediu data inválida, buscar a partir daquela data (não de hoje)
      const agora = dataInvalidaOriginal ? new Date(dataInvalidaOriginal) : new Date();
      const horaAtual = agora.getHours();
      const minutoAtual = agora.getMinutes();
      
      // Criar cópia apenas para comparação de datas
      const hoje = new Date(agora);
      hoje.setHours(0, 0, 0, 0);
      
      console.log(`🔍 Buscando próximas datas disponíveis a partir de ${agora.toLocaleDateString('pt-BR')} ${dataInvalidaOriginal ? '(data solicitada: ' + dataInvalidaOriginal + ')' : '(hoje)'} - próximos ${dias_busca} dias`);
      
      let datasVerificadas = 0;
      let datasPuladasDiaSemana = 0;
      let datasPuladasBloqueio = 0;
      let datasSemVagas = 0;
      
      for (let i = 0; i < dias_busca; i++) {
        const dataAtual = new Date(hoje);
        dataAtual.setDate(dataAtual.getDate() + i);
        
        const dataFormatada = dataAtual.toISOString().split('T')[0];
        const diaSemana = dataAtual.getDay();
        datasVerificadas++;
        
        // Verificar se o médico atende neste dia
        if (servico.dias_semana && !servico.dias_semana.includes(diaSemana)) {
          datasPuladasDiaSemana++;
          continue;
        }

        // 🔒 Verificar se a data está bloqueada
        const { data: bloqueios, error: bloqueioError } = await supabase
          .from('bloqueios_agenda')
          .select('id, motivo')
          .eq('medico_id', medico.id)
          .lte('data_inicio', dataFormatada)
          .gte('data_fim', dataFormatada)
          .eq('status', 'ativo')
          .eq('cliente_id', clienteId);

        if (!bloqueioError && bloqueios && bloqueios.length > 0) {
          console.log(`⛔ Data ${dataFormatada} bloqueada:`, bloqueios[0].motivo);
          datasPuladasBloqueio++;
          continue;
        }

        // Verificar disponibilidade para esta data
        const periodosDisponiveis = [];
        
        // 🔧 CORREÇÃO: Serviços sem periodos próprios (ex: ligadura_hemorroidas) que compartilham limite
        // Usar lógica especial para verificar vagas via limites compartilhados
        const servicoSemPeriodos = !servico.periodos || Object.keys(servico.periodos).length === 0;
        const compartilhaLimite = servico.compartilha_limite_com;
        const ehHoraMarcada = (servico.tipo_agendamento === 'hora_marcada' || servico.tipo === 'procedimento');
        
        if (servicoSemPeriodos && compartilhaLimite) {
          console.log(`🔄 [SERVIÇO SEM PERIODOS] ${servicoKey} compartilha limite com ${compartilhaLimite}`);
          
          // Buscar atendimento_id para o cálculo de sublimite
          let atendimentoId: string | null = null;
          if (!servico.atendimento_id) {
            const { data: atendData } = await supabase
              .from('atendimentos')
              .select('id')
              .eq('medico_id', medico.id)
              .eq('cliente_id', clienteId)
              .eq('ativo', true)
              .ilike('nome', `%${servicoKey.replace(/_/g, '%')}%`)
              .maybeSingle();
            atendimentoId = atendData?.id || null;
          } else {
            atendimentoId = servico.atendimento_id;
          }
          
          // Calcular vagas disponíveis considerando pool compartilhado e sublimite
          const servicoConfigComAtendId = { ...servico, atendimento_id: atendimentoId };
          const vagasDisponiveis = await calcularVagasDisponiveisComLimites(
            supabase,
            clienteId,
            medico.id,
            dataFormatada,
            servicoKey,
            servicoConfigComAtendId,
            regras
          );
          
          console.log(`📊 [LIMITE COMPARTILHADO] ${servicoKey} em ${dataFormatada}: ${vagasDisponiveis} vagas`);
          
          if (vagasDisponiveis > 0) {
            // Para hora_marcada, verificar horários vazios disponíveis
            if (ehHoraMarcada) {
              // Buscar horários vazios para esta data
              const { data: horariosVazios, error: horariosError } = await supabase
                .from('horarios_vazios')
                .select('hora')
                .eq('medico_id', medico.id)
                .eq('cliente_id', clienteId)
                .eq('data', dataFormatada)
                .eq('status', 'disponivel')
                .order('hora', { ascending: true });
              
              if (!horariosError && horariosVazios && horariosVazios.length > 0) {
                // Filtrar horários já ocupados
                const { data: agendamentosExistentes } = await supabase
                  .from('agendamentos')
                  .select('hora_agendamento')
                  .eq('medico_id', medico.id)
                  .eq('data_agendamento', dataFormatada)
                  .eq('cliente_id', clienteId)
                  .is('excluido_em', null)
                  .in('status', ['agendado', 'confirmado']);
                
                const horariosOcupados = new Set(agendamentosExistentes?.map(a => a.hora_agendamento) || []);
                const horariosLivres = horariosVazios.filter(h => {
                  const horaFormatada = h.hora.includes(':') ? h.hora : `${h.hora}:00:00`;
                  return !horariosOcupados.has(horaFormatada);
                });
                
                if (horariosLivres.length > 0) {
                  // Classificar o período (manhã/tarde) baseado no primeiro horário
                  const primeiroHorario = horariosLivres[0]?.hora;
                  const [horaH] = primeiroHorario ? primeiroHorario.split(':').map(Number) : [8];
                  const periodoNome = horaH < 12 ? 'Manhã' : 'Tarde';
                  
                  periodosDisponiveis.push({
                    periodo: periodoNome,
                    horario_distribuicao: `${horariosLivres.length} horário(s) específico(s) disponível(is)`,
                    vagas_disponiveis: Math.min(vagasDisponiveis, horariosLivres.length),
                    total_vagas: servico.limite_proprio || vagasDisponiveis,
                    horarios: horariosLivres.map(h => h.hora)
                  });
                  
                  console.log(`✅ [HORA MARCADA] ${horariosLivres.length} horários disponíveis para ${servicoKey} em ${dataFormatada}`);
                }
              } else {
                console.log(`⚠️ [HORA MARCADA] Nenhum horário vazio encontrado para ${dataFormatada}`);
              }
            } else {
              // Ordem de chegada - apenas adicionar período genérico
              periodosDisponiveis.push({
                periodo: 'Disponível',
                horario_distribuicao: 'Conforme disponibilidade',
                vagas_disponiveis: vagasDisponiveis,
                total_vagas: servico.limite_proprio || vagasDisponiveis
              });
            }
          }
        } else if (servicoSemPeriodos) {
          // Serviço sem periodos e sem limite compartilhado - erro de configuração
          console.error(`❌ [ERRO CONFIG] Serviço ${servicoKey} não tem periodos nem compartilha limite`);
          datasSemVagas++;
          continue;
        }
        
        // 🔧 Loop normal para serviços COM periodos definidos
        if (servico.periodos && Object.keys(servico.periodos).length > 0) {
        for (const [periodo, config] of Object.entries(servico.periodos)) {
          // 🆕 FILTRAR POR PERÍODO PREFERIDO
          if (periodoPreferido === 'tarde' && periodo === 'manha') {
            console.log('⏭️ Pulando manhã (paciente quer tarde)');
            continue;
          }
          if (periodoPreferido === 'manha' && periodo === 'tarde') {
            console.log('⏭️ Pulando tarde (paciente quer manhã)');
            continue;
          }
          
          if ((config as any).dias_especificos && !(config as any).dias_especificos.includes(diaSemana)) {
            continue;
          }

          // 🆕 FILTRAR PERÍODOS QUE JÁ PASSARAM NO DIA ATUAL
          const ehHoje = (i === 0);
          
          if (ehHoje && (config as any)?.fim) {
            // Extrair horário de FIM do período
            const [horaFim, minFim] = (config as any).fim.split(':').map(Number);
            const horarioFimEmMinutos = horaFim * 60 + minFim;
            const horarioAtualEmMinutos = horaAtual * 60 + minutoAtual;
            
            // Se o período já acabou completamente, pular
            if (horarioFimEmMinutos <= horarioAtualEmMinutos) {
              console.log(`⏭️ Pulando período ${periodo} de hoje (fim ${(config as any).fim} ≤ ${horaAtual}:${minutoAtual.toString().padStart(2, '0')})`);
              continue;
            }
            
            console.log(`✅ Período ${periodo} ainda está válido hoje (fim ${(config as any).fim} > ${horaAtual}:${minutoAtual.toString().padStart(2, '0')})`);
          }

          // ✅ Para ORDEM DE CHEGADA: buscar TODOS os agendamentos do dia
          const { data: todosAgendamentos, error: countError } = await supabase
            .from('agendamentos')
            .select('hora_agendamento')
            .eq('medico_id', medico.id)
            .eq('data_agendamento', dataFormatada)
            .eq('cliente_id', clienteId)
            .is('excluido_em', null)
            .in('status', ['agendado', 'confirmado']);

          if (countError) {
            console.error('❌ Erro ao buscar agendamentos:', countError);
            continue;
          }

          // Classificar cada agendamento no período correto
          let vagasOcupadas = 0;
          if (todosAgendamentos && todosAgendamentos.length > 0) {
            vagasOcupadas = todosAgendamentos.filter(ag => {
              const periodoClassificado = classificarPeriodoAgendamento(
                ag.hora_agendamento, 
                { [periodo]: config }
              );
              return periodoClassificado === periodo;
            }).length;
            
            console.log(`📊 [DISPONIBILIDADE] Data: ${dataFormatada}`);
            console.log(`📊 [DISPONIBILIDADE] Período ${periodo}:`);
            console.log(`   - Total agendamentos no dia: ${todosAgendamentos.length}`);
            console.log(`   - Agendamentos neste período: ${vagasOcupadas}`);
            console.log(`   - Limite do período: ${(config as any).limite}`);
          } else {
            console.log(`📊 [DISPONIBILIDADE] Data: ${dataFormatada} - Período ${periodo}: SEM agendamentos`);
            console.log(`   - Limite do período: ${(config as any).limite}`);
          }

          const vagasDisponiveis = (config as any).limite - vagasOcupadas;
          console.log(`   - 🎯 Vagas disponíveis: ${vagasDisponiveis}`);

          if (vagasDisponiveis > 0) {
            periodosDisponiveis.push({
              periodo: periodo === 'manha' ? 'Manhã' : 'Tarde',
              horario_distribuicao: (config as any).distribuicao_fichas || `${(config as any).inicio} às ${(config as any).fim}`,
              vagas_disponiveis: vagasDisponiveis,
              total_vagas: (config as any).limite
            });
          }
        }
        } // 🔧 Fecha o if (servico.periodos && Object.keys(servico.periodos).length > 0)

        // Se encontrou períodos disponíveis nesta data, adicionar
        if (periodosDisponiveis.length > 0) {
          const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
          proximasDatas.push({
            data: dataFormatada,
            dia_semana: diasSemana[diaSemana],
            periodos: periodosDisponiveis
          });
          
          console.log(`✅ Data disponível encontrada: ${dataFormatada} (${diasSemana[diaSemana]})`);
          
          // Limitar a 5 datas
          if (proximasDatas.length >= 5) break;
        } else {
          datasSemVagas++;
        }
      }

      console.log(`📊 Estatísticas da busca:
        - Datas verificadas: ${datasVerificadas}
        - Puladas (dia da semana): ${datasPuladasDiaSemana}
        - Puladas (bloqueio): ${datasPuladasBloqueio}
        - Sem vagas: ${datasSemVagas}
        - Datas disponíveis encontradas: ${proximasDatas.length}`);

      // ✅ Validação: verificar total de vagas
      if (proximasDatas.length > 0) {
        proximasDatas.forEach((data: any) => {
          const totalVagasData = data.periodos.reduce(
            (sum: number, p: any) => sum + p.vagas_disponiveis, 
            0
          );
          console.log(`✅ [VALIDAÇÃO] ${data.data} tem ${totalVagasData} vagas totais distribuídas em ${data.periodos.length} período(s)`);
          data.periodos.forEach((p: any) => {
            console.log(`   → ${p.periodo}: ${p.vagas_disponiveis}/${p.total_vagas} vagas`);
          });
        });
      }

      if (proximasDatas.length === 0) {
        return businessErrorResponse({
          codigo_erro: 'SEM_VAGAS_DISPONIVEIS',
          mensagem_usuario: `😔 Não encontrei vagas disponíveis para ${medico.nome} - ${servicoKey} nos próximos ${dias_busca} dias.\n\n📞 Sugestões:\n   • Ligue para ${getClinicPhone(config)} para verificar outras opções\n   • Entre na fila de espera\n   • Consulte disponibilidade em outras especialidades`,
          detalhes: {
            medico: medico.nome,
            servico: servicoKey,
            dias_buscados: dias_busca,
            periodo_solicitado: periodoPreferido || 'qualquer'
          }
        });
      }

      // 🆕 MENSAGEM CONTEXTUAL baseada na disponibilidade
      let mensagemInicial = '';
      
      // 🎯 CONTEXTO DE DATA INVÁLIDA (quando houve redirecionamento)
      if (dataInvalidaOriginal && diaNomeInvalido) {
        const [ano, mes, dia] = dataInvalidaOriginal.split('-');
        const dataFormatada = `${dia}/${mes}/${ano}`;
        mensagemInicial = `⚠️ A data ${dataFormatada} (${diaNomeInvalido}) não está disponível para ${medico.nome}.\n\n`;
        mensagemInicial += `✅ Mas encontrei estas datas disponíveis:\n\n`;
      } else if (proximasDatas.length === 1) {
        mensagemInicial = `😊 Encontrei apenas 1 data disponível para ${medico.nome}:\n\n`;
      } else if (proximasDatas.length <= 3) {
        mensagemInicial = `✅ ${medico.nome} está com poucas vagas. Encontrei ${proximasDatas.length} datas:\n\n`;
      } else {
        mensagemInicial = `✅ ${medico.nome} - ${servicoKey}\n\n📅 ${proximasDatas.length} datas disponíveis:\n\n`;
      }
      
      const listaDatas = proximasDatas.map((d: any) => {
        const periodos = d.periodos.map((p: any) => 
          `  • ${p.periodo}: ${p.horario_distribuicao} - ${p.vagas_disponiveis} vaga(s)`
        ).join('\n');
        return `📆 ${d.dia_semana}, ${d.data}\n${periodos}`;
      }).join('\n\n');
      
      const avisoOrdemChegada = (tipoAtendimento === 'ordem_chegada' 
        ? '\n\n⚠️ ORDEM DE CHEGADA\nChegue no período indicado para pegar ficha.'
        : '');
      
      const callToAction = '\n\n💬 Qual data funciona melhor para você?';
      
      const mensagem = mensagemInicial + listaDatas + avisoOrdemChegada + callToAction;

      // 🆕 FLAG DE BAIXA DISPONIBILIDADE
      const baixaDisponibilidade = proximasDatas.length <= 2;
      
      return successResponse({
        disponivel: true,
        tipo_agendamento: tipoAtendimento,
        medico: medico.nome,
        servico: servicoKey,
        horario_busca: agora.toISOString(),
        proximas_datas: proximasDatas,
        mensagem_whatsapp: mensagem,
        message: mensagem,
        baixa_disponibilidade: baixaDisponibilidade,  // 🆕 FLAG
        total_datas_encontradas: proximasDatas.length,
        ...(dataInvalidaOriginal && { // 🆕 ADICIONAR CONTEXTO DE REDIRECIONAMENTO
          data_solicitada_invalida: dataInvalidaOriginal,
          dia_invalido: diaNomeInvalido,
          motivo_redirecionamento: `${medico.nome} não atende ${servicoKey} aos ${diaNomeInvalido}s`
        }),
        contexto: {
          medico_id: medico.id,
          medico_nome: medico.nome,
          servico: atendimento_nome,
          periodo_solicitado: periodoPreferido,
          dias_buscados: quantidade_dias
        }
      });
    }

    // 🎯 COMPORTAMENTO: VERIFICAR DATA ESPECÍFICA (se não entrou no bloco anterior)
    // Se chegamos aqui, significa que data_consulta ainda existe (não foi redirecionada)
    // Recalcular diaSemana se necessário
    if (!diaSemana && data_consulta) {
      diaSemana = getDiaSemana(data_consulta);
      console.log(`📅 Recalculando dia da semana para ${data_consulta}: ${diasNomes[diaSemana]}`);
    }
    
    // 🔒 VERIFICAR SE A DATA ESTÁ BLOQUEADA
    const { data: bloqueios, error: bloqueioError } = await supabase
      .from('bloqueios_agenda')
      .select('id, motivo')
      .eq('medico_id', medico.id)
      .lte('data_inicio', data_consulta)
      .gte('data_fim', data_consulta)
      .eq('status', 'ativo')
      .eq('cliente_id', clienteId);

    if (!bloqueioError && bloqueios && bloqueios.length > 0) {
      console.log(`⛔ Data ${data_consulta} bloqueada:`, bloqueios[0].motivo);
      
      // 🆕 Buscar próximas datas disponíveis automaticamente
      const proximasDatas = await buscarProximasDatasDisponiveis(
        supabase,
        medico,
        servicoKey,
        servico,
        data_consulta,
        clienteId,
        periodoPreferido,
        60,
        5
      );
      
      let mensagem = `❌ A agenda do(a) ${medico.nome} está bloqueada em ${data_consulta}.\n`;
      mensagem += `📋 Motivo: ${bloqueios[0].motivo}\n\n`;
      
      if (proximasDatas.length > 0) {
        mensagem += `✅ Próximas datas disponíveis:\n\n`;
        proximasDatas.forEach(d => {
          mensagem += `📅 ${d.data} (${d.dia_semana}) - ${d.periodo} - ${d.vagas_disponiveis} vaga(s)\n`;
        });
        mensagem += `\n💡 Gostaria de agendar em uma destas datas?`;
      } else {
        mensagem += `⚠️ Não encontramos vagas nos próximos 60 dias.\n`;
        mensagem += `Por favor, entre em contato com a clínica.`;
      }
      
      return successResponse({
        disponivel: false,
        bloqueada: true,
        medico: medico.nome,
        servico: servicoKey,
        data: data_consulta,
        motivo_bloqueio: bloqueios[0].motivo,
        proximas_datas: proximasDatas,
        message: mensagem
      });
    }

    // 🎯 TIPO DE ATENDIMENTO JÁ DETECTADO (linha 1247)
    console.log(`📋 Tipo de atendimento: ${tipoAtendimento} (já detectado anteriormente)`);

    // Contar agendamentos existentes para cada período
    const periodosDisponiveis = [];
    
    // 🔧 CORREÇÃO: Serviços sem periodos próprios (ex: ligadura_hemorroidas) que compartilham limite
    const servicoSemPeriodosFluxo3 = !servico.periodos || Object.keys(servico.periodos).length === 0;
    const compartilhaLimiteFluxo3 = servico.compartilha_limite_com;
    const ehHoraMarcadaFluxo3 = (servico.tipo_agendamento === 'hora_marcada' || servico.tipo === 'procedimento');
    
    if (servicoSemPeriodosFluxo3 && compartilhaLimiteFluxo3 && data_consulta) {
      console.log(`🔄 [FLUXO 3 - SEM PERIODOS] ${servicoKey} compartilha limite com ${compartilhaLimiteFluxo3}`);
      
      // Buscar atendimento_id para cálculo do sublimite
      let atendimentoIdFluxo3: string | null = null;
      if (!servico.atendimento_id) {
        const { data: atendData } = await supabase
          .from('atendimentos')
          .select('id')
          .eq('medico_id', medico.id)
          .eq('cliente_id', clienteId)
          .eq('ativo', true)
          .ilike('nome', `%${servicoKey.replace(/_/g, '%')}%`)
          .maybeSingle();
        atendimentoIdFluxo3 = atendData?.id || null;
      } else {
        atendimentoIdFluxo3 = servico.atendimento_id;
      }
      
      // Calcular vagas disponíveis
      const servicoConfigFluxo3 = { ...servico, atendimento_id: atendimentoIdFluxo3 };
      const vagasDisponiveisFluxo3 = await calcularVagasDisponiveisComLimites(
        supabase,
        clienteId,
        medico.id,
        data_consulta,
        servicoKey,
        servicoConfigFluxo3,
        regras
      );
      
      console.log(`📊 [FLUXO 3 - LIMITE COMPARTILHADO] ${servicoKey} em ${data_consulta}: ${vagasDisponiveisFluxo3} vagas`);
      
      if (vagasDisponiveisFluxo3 > 0) {
        if (ehHoraMarcadaFluxo3) {
          // Buscar horários vazios para esta data
          const { data: horariosVaziosFluxo3 } = await supabase
            .from('horarios_vazios')
            .select('hora')
            .eq('medico_id', medico.id)
            .eq('cliente_id', clienteId)
            .eq('data', data_consulta)
            .eq('status', 'disponivel')
            .order('hora', { ascending: true });
          
          if (horariosVaziosFluxo3 && horariosVaziosFluxo3.length > 0) {
            // Filtrar horários ocupados
            const { data: agendamentosFluxo3 } = await supabase
              .from('agendamentos')
              .select('hora_agendamento')
              .eq('medico_id', medico.id)
              .eq('data_agendamento', data_consulta)
              .eq('cliente_id', clienteId)
              .is('excluido_em', null)
              .in('status', ['agendado', 'confirmado']);
            
            const horariosOcupadosFluxo3 = new Set(agendamentosFluxo3?.map(a => a.hora_agendamento) || []);
            const horariosLivresFluxo3 = horariosVaziosFluxo3.filter(h => {
              const horaFormatada = h.hora.includes(':') ? h.hora : `${h.hora}:00:00`;
              return !horariosOcupadosFluxo3.has(horaFormatada);
            });
            
            if (horariosLivresFluxo3.length > 0 && horariosLivresFluxo3[0]?.hora) {
              const [horaH] = horariosLivresFluxo3[0].hora.split(':').map(Number);
              const periodoNome = horaH < 12 ? 'Manhã' : 'Tarde';
              
              periodosDisponiveis.push({
                periodo: periodoNome,
                disponivel: true,
                hora_inicio: horariosLivresFluxo3[0].hora,
                hora_fim: horariosLivresFluxo3[horariosLivresFluxo3.length - 1].hora,
                horario_distribuicao: `${horariosLivresFluxo3.length} horário(s) específico(s)`,
                vagas_disponiveis: Math.min(vagasDisponiveisFluxo3, horariosLivresFluxo3.length),
                total_vagas: servico.limite_proprio || vagasDisponiveisFluxo3,
                intervalo_minutos: 30,
                horarios: horariosLivresFluxo3.map(h => h.hora)
              });
              
              console.log(`✅ [FLUXO 3 - HORA MARCADA] ${horariosLivresFluxo3.length} horários disponíveis`);
            }
          }
        } else {
          periodosDisponiveis.push({
            periodo: 'Disponível',
            disponivel: true,
            horario_distribuicao: 'Conforme disponibilidade',
            vagas_disponiveis: vagasDisponiveisFluxo3,
            total_vagas: servico.limite_proprio || vagasDisponiveisFluxo3
          });
        }
      }
    }
    
    // 🔧 Loop normal para serviços COM periodos definidos
    if (servico.periodos && Object.keys(servico.periodos).length > 0) {
    for (const [periodo, config] of Object.entries(servico.periodos)) {
      // 🆕 FILTRAR POR PERÍODO PREFERIDO
      if (periodoPreferido === 'tarde' && periodo === 'manha') {
        console.log('⏭️ [FLUXO 3] Pulando manhã (paciente quer tarde)');
        continue;
      }
      if (periodoPreferido === 'manha' && periodo === 'tarde') {
        console.log('⏭️ [FLUXO 3] Pulando tarde (paciente quer manhã)');
        continue;
      }
      
      // Verificar se o período é válido para este dia da semana
      if ((config as any).dias_especificos && !(config as any).dias_especificos.includes(diaSemana)) {
        continue;
      }

      // 🆕 SE A DATA FOR HOJE, VERIFICAR SE O PERÍODO JÁ PASSOU
      const ehHoje = (data_consulta === dataAtual);
      
      if (ehHoje && (config as any)?.fim) {
        const [horaFim, minFim] = (config as any).fim.split(':').map(Number);
        const horarioFimEmMinutos = horaFim * 60 + minFim;
        
        // Se o período já acabou, pular
        if (horarioFimEmMinutos <= horarioAtualEmMinutos) {
          console.log(`⏭️ Pulando período ${periodo} (fim ${(config as any).fim} já passou às ${horaAtual}:${getDataHoraAtualBrasil().minuto})`);
          continue;
        }
      }

      // ✅ Para ORDEM DE CHEGADA: buscar TODOS os agendamentos do dia
      const { data: todosAgendamentosData, error: countError } = await supabase
        .from('agendamentos')
        .select('hora_agendamento')
        .eq('medico_id', medico.id)
        .eq('data_agendamento', data_consulta)
        .eq('cliente_id', clienteId)
        .is('excluido_em', null)
        .in('status', ['agendado', 'confirmado']);

      if (countError) {
        console.error('❌ Erro ao buscar agendamentos:', countError);
        continue;
      }

      // Classificar cada agendamento no período correto
      let vagasOcupadas = 0;
      if (todosAgendamentosData && todosAgendamentosData.length > 0) {
        vagasOcupadas = todosAgendamentosData.filter(ag => {
          const periodoClassificado = classificarPeriodoAgendamento(
            ag.hora_agendamento,
            { [periodo]: config }
          );
          return periodoClassificado === periodo;
        }).length;
        
        console.log(`📊 ${data_consulta} - Período ${periodo}: ${vagasOcupadas}/${(config as any).limite} vagas ocupadas`);
        console.log(`   Horários encontrados:`, todosAgendamentosData.map(a => a.hora_agendamento).join(', '));
      }

      const vagasDisponiveis = (config as any).limite - vagasOcupadas;

      periodosDisponiveis.push({
        periodo: periodo === 'manha' ? 'Manhã' : 'Tarde',
        horario_distribuicao: (config as any).distribuicao_fichas || `${(config as any).inicio} às ${(config as any).fim}`,
        vagas_ocupadas: vagasOcupadas,
        vagas_disponiveis: vagasDisponiveis,
        total_vagas: (config as any).limite,
        disponivel: vagasDisponiveis > 0,
        hora_inicio: (config as any).inicio,
        hora_fim: (config as any).fim,
        intervalo_minutos: (config as any).intervalo_minutos
      });
    }
    } // 🔧 Fecha o if (servico.periodos && Object.keys(servico.periodos).length > 0)

    if (periodosDisponiveis.length === 0) {
      console.log(`❌ Nenhum período disponível para ${data_consulta}. Buscando alternativas...`);
      
      // 🔍 Buscar próximas datas disponíveis mantendo período preferido
      const proximasDatas = await buscarProximasDatasDisponiveis(
        supabase,
        medico,
        servicoKey,
        servico,
        data_consulta,
        clienteId,
        periodoPreferido, // ✅ Mantém período solicitado (manhã/tarde)
        60, // Buscar nos próximos 60 dias
        5   // Máximo 5 sugestões
      );
      
      // 🎯 Montar mensagem contextualizada
      const periodoTexto = periodoPreferido === 'manha' ? 'Manhã' : 
                           periodoPreferido === 'tarde' ? 'Tarde' : 
                           periodoPreferido ? periodoPreferido : '';
      
      let mensagem = `❌ ${medico.nome} não atende ${servicoKey}`;
      
      if (periodoTexto) {
        mensagem += ` no período da ${periodoTexto}`;
      }
      
      mensagem += ` na data ${data_consulta}.\n\n`;
      
      if (proximasDatas.length > 0) {
        mensagem += `✅ Próximas datas disponíveis`;
        
        if (periodoTexto) {
          mensagem += ` no período da ${periodoTexto}`;
        }
        
        mensagem += `:\n\n`;
        
        proximasDatas.forEach(d => {
          mensagem += `📅 ${d.data} (${d.dia_semana}) - ${d.periodo || ''} - ${d.vagas_disponiveis} vaga(s)\n`;
        });
        
        mensagem += `\n💡 Gostaria de agendar em uma destas datas?`;
      } else {
        mensagem += `⚠️ Não encontramos vagas`;
        
        if (periodoTexto) {
          mensagem += ` no período da ${periodoTexto}`;
        }
        
        mensagem += ` nos próximos 60 dias.\n\n`;
        mensagem += `📞 Por favor, entre em contato:\n`;
        mensagem += `   • Telefone: ${getClinicPhone(config)}\n`;
        mensagem += `   • Opções: Fila de espera ou outros períodos`;
      }
      
      // ✅ Retornar resposta estruturada (status 200)
      return successResponse({
        disponivel: false,
        motivo: 'periodo_data_nao_disponivel',
        medico: medico.nome,
        servico: servicoKey,
        data_solicitada: data_consulta,
        periodo_solicitado: periodoPreferido,
        proximas_datas: proximasDatas,
        message: mensagem,
        contexto: {
          medico_id: medico.id,
          medico_nome: medico.nome,
          servico: atendimento_nome,
          data_original: data_consulta,
          periodo_preferido: periodoPreferido,
          total_alternativas: proximasDatas.length
        }
      });
    }

    // 🎯 RESPOSTA DIFERENCIADA POR TIPO DE ATENDIMENTO
    // Usar função getTipoAgendamentoEfetivo para determinar tipo real
    const tipoEfetivo = getTipoAgendamentoEfetivo(servico, regras);
    console.log(`📋 [DISPONIBILIDADE] Tipo efetivo: ${tipoEfetivo}`);

    if (isOrdemChegada(tipoEfetivo)) {
      // ✅ ORDEM DE CHEGADA - NÃO retorna horários específicos
      console.log('✅ Retornando disponibilidade por ORDEM DE CHEGADA');
      
      const temVagas = periodosDisponiveis.some(p => p.disponivel);
      
      // 🆕 Se não tem vagas, buscar próximas datas
      if (!temVagas) {
        const proximasDatas = await buscarProximasDatasDisponiveis(
          supabase,
          medico,
          servicoKey,
          servico,
          data_consulta,
          clienteId,
          periodoPreferido,
          60,
          5
        );
        
        let mensagem = `❌ Sem vagas disponíveis para ${medico.nome} em ${data_consulta}.\n\n`;
        
        if (proximasDatas.length > 0) {
          mensagem += `✅ Próximas datas disponíveis:\n\n`;
          proximasDatas.forEach(d => {
            mensagem += `📅 ${d.data} (${d.dia_semana}) - ${d.periodo} - ${d.vagas_disponiveis} vaga(s)\n`;
          });
          mensagem += `\n💡 Gostaria de agendar em uma destas datas?`;
        } else {
          mensagem += `⚠️ Não encontramos vagas nos próximos 60 dias.\n`;
          mensagem += `Por favor, entre em contato com a clínica.`;
        }
        
        return successResponse({
          disponivel: false,
          tipo_agendamento: TIPO_ORDEM_CHEGADA,
          medico: medico.nome,
          servico: servicoKey,
          data: data_consulta,
          periodos: periodosDisponiveis,
          proximas_datas: proximasDatas,
          mensagem_whatsapp: mensagem,
          message: mensagem
        });
      }
      
      // Se tem vagas, retornar normalmente
      const mensagem = `✅ ${medico.nome} - ${servicoKey}\n📅 ${data_consulta}\n\n` +
        periodosDisponiveis.filter(p => p.disponivel).map(p => 
          `${p.periodo}: ${p.vagas_disponiveis} vaga(s) disponível(is) de ${p.total_vagas}\n` +
          `Distribuição: ${p.horario_distribuicao}`
        ).join('\n\n') +
        '\n\n⚠️ ORDEM DE CHEGADA: Não há horário marcado. Paciente deve chegar no período para pegar ficha.';
      
      return successResponse({
        disponivel: true,
        tipo_agendamento: TIPO_ORDEM_CHEGADA,
        medico: medico.nome,
        servico: servicoKey,
        data: data_consulta,
        periodos: periodosDisponiveis,
        mensagem_whatsapp: mensagem,
        message: mensagem
      });
    } else if (isEstimativaHorario(tipoEfetivo)) {
      // ✅ ESTIMATIVA DE HORÁRIO - retorna horários ESTIMADOS (híbrido)
      console.log('✅ Retornando disponibilidade por ESTIMATIVA DE HORÁRIO');
      
      const horariosEstimados = [];
      const mensagemEstimativa = getMensagemEstimativa(servico, null);
      
      for (const periodo of periodosDisponiveis) {
        if (!periodo.disponivel) continue;

        // Usar intervalo_estimado do serviço ou período
        const intervaloMinutos = getIntervaloMinutos(tipoEfetivo, servico, periodo);
        console.log(`📋 [ESTIMATIVA] Intervalo: ${intervaloMinutos} minutos`);
        
        // Gerar slots de tempo estimados
        const [horaInicio, minInicio] = periodo.hora_inicio.split(':').map(Number);
        const [horaFim, minFim] = periodo.hora_fim.split(':').map(Number);
        
        let horaAtual = horaInicio * 60 + minInicio;
        const horaLimite = horaFim * 60 + minFim;
        
        while (horaAtual < horaLimite) {
          const h = Math.floor(horaAtual / 60);
          const m = horaAtual % 60;
          const horarioFormatado = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
          
          // Verificar se este horário específico está ocupado
          const { count } = await supabase
            .from('agendamentos')
            .select('*', { count: 'exact', head: true })
            .eq('medico_id', medico.id)
            .eq('data_agendamento', data_consulta)
            .eq('hora_agendamento', horarioFormatado)
            .eq('cliente_id', clienteId)
            .is('excluido_em', null)
            .in('status', ['agendado', 'confirmado']);
          
          if (count === 0) {
            horariosEstimados.push({
              hora: horarioFormatado,
              hora_formatada: formatarHorarioParaExibicao(horarioFormatado, tipoEfetivo, periodo),
              disponivel: true,
              periodo: periodo.periodo.toLowerCase(),
              eh_estimativa: true
            });
          }
          
          horaAtual += intervaloMinutos;
        }
      }

      // 🆕 Se não tem horários, buscar próximas datas
      if (horariosEstimados.length === 0) {
        const proximasDatas = await buscarProximasDatasDisponiveis(
          supabase,
          medico,
          servicoKey,
          servico,
          data_consulta,
          clienteId,
          periodoPreferido,
          60,
          5
        );
        
        let mensagem = `❌ Sem horários disponíveis para ${medico.nome} em ${data_consulta}.\n\n`;
        
        if (proximasDatas.length > 0) {
          mensagem += `✅ Próximas datas disponíveis:\n\n`;
          proximasDatas.forEach(d => {
            mensagem += `📅 ${d.data} (${d.dia_semana}) - ${d.periodo} - ${d.vagas_disponiveis} vaga(s)\n`;
          });
          mensagem += `\n💡 Gostaria de agendar em uma destas datas?`;
        } else {
          mensagem += `⚠️ Não encontramos vagas nos próximos 60 dias.\n`;
          mensagem += `Por favor, entre em contato com a clínica.`;
        }
        
        return successResponse({
          disponivel: false,
          tipo_agendamento: TIPO_ESTIMATIVA_HORARIO,
          medico: medico.nome,
          servico: servicoKey,
          data: data_consulta,
          horarios_estimados: [],
          total: 0,
          proximas_datas: proximasDatas,
          mensagem_estimativa: mensagemEstimativa,
          mensagem_whatsapp: mensagem,
          message: mensagem
        });
      }

      // Se tem horários estimados, retornar com formatação adequada
      const mensagem = `✅ ${medico.nome} - ${servicoKey}\n📅 ${data_consulta}\n\n` +
        `${horariosEstimados.length} horário(s) estimado(s) disponível(is):\n` +
        horariosEstimados.slice(0, 10).map(h => `• ${h.hora_formatada}`).join('\n') +
        (horariosEstimados.length > 10 ? `\n... e mais ${horariosEstimados.length - 10} horário(s)` : '') +
        `\n\n⏰ ${mensagemEstimativa}`;
      
      return successResponse({
        disponivel: horariosEstimados.length > 0,
        tipo_agendamento: TIPO_ESTIMATIVA_HORARIO,
        medico: medico.nome,
        servico: servicoKey,
        data: data_consulta,
        horarios_estimados: horariosEstimados,
        horarios_disponiveis: horariosEstimados, // compatibilidade
        total: horariosEstimados.length,
        mensagem_estimativa: mensagemEstimativa,
        mensagem_whatsapp: mensagem,
        message: mensagem
      });
    } else {
      // ✅ HORA MARCADA - retorna slots específicos (exatos)
      console.log('✅ Retornando disponibilidade por HORA MARCADA');
      const horariosDisponiveis = [];
      
      for (const periodo of periodosDisponiveis) {
        if (!periodo.disponivel) continue;

        const intervaloMinutos = periodo.intervalo_minutos || 30;
        
        // Gerar slots de tempo
        const [horaInicio, minInicio] = periodo.hora_inicio.split(':').map(Number);
        const [horaFim, minFim] = periodo.hora_fim.split(':').map(Number);
        
        let horaAtual = horaInicio * 60 + minInicio;
        const horaLimite = horaFim * 60 + minFim;
        
        while (horaAtual < horaLimite) {
          const h = Math.floor(horaAtual / 60);
          const m = horaAtual % 60;
          const horarioFormatado = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
          
          // Verificar se este horário específico está ocupado
          const { count } = await supabase
            .from('agendamentos')
            .select('*', { count: 'exact', head: true })
            .eq('medico_id', medico.id)
            .eq('data_agendamento', data_consulta)
            .eq('hora_agendamento', horarioFormatado)
            .eq('cliente_id', clienteId)
            .is('excluido_em', null)
            .in('status', ['agendado', 'confirmado']);
          
          if (count === 0) {
            horariosDisponiveis.push({
              hora: horarioFormatado,
              disponivel: true,
              periodo: periodo.periodo.toLowerCase()
            });
          }
          
          horaAtual += intervaloMinutos;
        }
      }

      // 🆕 Se não tem horários, buscar próximas datas
      if (horariosDisponiveis.length === 0) {
        const proximasDatas = await buscarProximasDatasDisponiveis(
          supabase,
          medico,
          servicoKey,
          servico,
          data_consulta,
          clienteId,
          periodoPreferido,
          60,
          5
        );
        
        let mensagem = `❌ Sem horários disponíveis para ${medico.nome} em ${data_consulta}.\n\n`;
        
        if (proximasDatas.length > 0) {
          mensagem += `✅ Próximas datas disponíveis:\n\n`;
          proximasDatas.forEach(d => {
            mensagem += `📅 ${d.data} (${d.dia_semana}) - ${d.periodo} - ${d.vagas_disponiveis} vaga(s)\n`;
          });
          mensagem += `\n💡 Gostaria de agendar em uma destas datas?`;
        } else {
          mensagem += `⚠️ Não encontramos vagas nos próximos 60 dias.\n`;
          mensagem += `Por favor, entre em contato com a clínica.`;
        }
        
        return successResponse({
          disponivel: false,
          tipo_agendamento: 'hora_marcada',
          medico: medico.nome,
          servico: servicoKey,
          data: data_consulta,
          horarios_disponiveis: [],
          total: 0,
          proximas_datas: proximasDatas,
          mensagem_whatsapp: mensagem,
          message: mensagem
        });
      }

      // Se tem horários, retornar normalmente
      const mensagem = `✅ ${medico.nome} - ${servicoKey}\n📅 ${data_consulta}\n\n` +
        `${horariosDisponiveis.length} horários disponíveis:\n` +
        horariosDisponiveis.map(h => `• ${h.hora}`).join('\n');
      
      return successResponse({
        disponivel: horariosDisponiveis.length > 0,
        tipo_agendamento: 'hora_marcada',
        medico: medico.nome,
        servico: servicoKey,
        data: data_consulta,
        horarios_disponiveis: horariosDisponiveis,
        total: horariosDisponiveis.length,
        mensagem_whatsapp: mensagem,
        message: mensagem
      });
    }

  } catch (error: any) {
    console.error('❌ [ERRO CRÍTICO] Falha ao verificar disponibilidade:', {
      error_message: error?.message,
      error_stack: error?.stack,
      error_code: error?.code,
      parametros_recebidos: body
    });
    
    return businessErrorResponse({
      codigo_erro: 'ERRO_SISTEMA',
      mensagem_usuario: `❌ Ocorreu um erro ao verificar a disponibilidade.\n\n📞 Por favor:\n   • Tente novamente em alguns instantes\n   • Ou entre em contato: ${getClinicPhone(config)}`,
      detalhes: {
        erro_tecnico: error?.message || 'Erro desconhecido',
        timestamp: new Date().toISOString()
      }
    });
  }
}

// Buscar pacientes
async function handlePatientSearch(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    const { busca, tipo } = body;

    if (!busca) {
      return errorResponse('Campo obrigatório: busca (nome, telefone ou data de nascimento)');
    }

    let query = supabase
      .from('pacientes')
      .select('id, nome_completo, data_nascimento, celular, telefone, convenio')
      .eq('cliente_id', clienteId)
      .limit(10);

    switch (tipo) {
      case 'nome':
        query = query.ilike('nome_completo', `%${busca}%`);
        break;
      case 'telefone':
        // Remover formatação e buscar apenas os dígitos
        const telefoneLimpo = busca.replace(/\D/g, '');
        if (telefoneLimpo.length < 8) {
          return errorResponse('Telefone deve ter pelo menos 8 dígitos');
        }
        // Buscar pelos últimos 8 dígitos para pegar tanto fixo quanto celular
        const ultimos8 = telefoneLimpo.slice(-8);
        query = query.or(`celular.ilike.%${ultimos8}%,telefone.ilike.%${ultimos8}%`);
        break;
      case 'nascimento':
        query = query.eq('data_nascimento', busca);
        break;
      default:
        // Busca geral - detectar tipo automaticamente
        const telefoneGeral = busca.replace(/\D/g, '');
        const isDataFormat = /^\d{4}-\d{2}-\d{2}$/.test(busca);
        
        if (isDataFormat) {
          // Se parece uma data, buscar por data E nome
          query = query.or(`nome_completo.ilike.%${busca}%,data_nascimento.eq.${busca}`);
        } else if (telefoneGeral.length >= 8) {
          // Se tem números suficientes, buscar por nome E telefone (últimos 8 dígitos)
          const ultimos8Geral = telefoneGeral.slice(-8);
          query = query.or(`nome_completo.ilike.%${busca}%,celular.ilike.%${ultimos8Geral}%,telefone.ilike.%${ultimos8Geral}%`);
        } else {
          // Apenas buscar por nome
          query = query.ilike('nome_completo', `%${busca}%`);
        }
    }

    const { data: pacientes, error } = await query;

    if (error) {
      return errorResponse(`Erro ao buscar pacientes: ${error.message}`);
    }

    return successResponse({
      message: `${pacientes?.length || 0} paciente(s) encontrado(s)`,
      pacientes: pacientes || [],
      total: pacientes?.length || 0
    });

  } catch (error: any) {
    return errorResponse(`Erro ao buscar pacientes: ${error?.message || 'Erro desconhecido'}`);
  }
}

/**
 * 🆕 FUNÇÃO AUXILIAR: Buscar próximas datas com período específico disponível
 */
async function buscarProximasDatasComPeriodo(
  supabase: any,
  medico: any,
  servico: any,
  periodo: 'manha' | 'tarde' | 'noite',
  dataInicial: string,
  clienteId: string,
  quantidade: number = 5,
  config: DynamicConfig | null = null
) {
  const datasEncontradas = [];
  const periodoMap = {
    'manha': 'manha',
    'tarde': 'tarde',
    'noite': 'noite'
  };
  const periodoKey = periodoMap[periodo];
  
  // Verificar se o serviço tem configuração para este período
  if (!servico.periodos?.[periodoKey]) {
    console.log(`⚠️ Serviço não atende no período: ${periodoKey}`);
    return [];
  }
  
  const configPeriodo = servico.periodos[periodoKey];
  
  console.log(`🔍 Buscando próximas ${quantidade} datas com ${periodo} disponível a partir de ${dataInicial}`);
  
  // Buscar próximos 30 dias (para garantir encontrar pelo menos 'quantidade' datas)
  for (let diasAdiantados = 1; diasAdiantados <= 30; diasAdiantados++) {
    const dataCheck = new Date(dataInicial + 'T00:00:00');
    dataCheck.setDate(dataCheck.getDate() + diasAdiantados);
    const dataCheckStr = dataCheck.toISOString().split('T')[0];
    const diaSemanaNum = dataCheck.getDay();
    
    // Verificar se data é válida (>= data mínima)
    const minBookingDate = getMinimumBookingDate(config);
    if (dataCheckStr < minBookingDate) {
      continue;
    }
    
    // Pular finais de semana (se aplicável)
    if (diaSemanaNum === 0 || diaSemanaNum === 6) {
      continue;
    }
    
    // Verificar disponibilidade APENAS do período específico
    const { data: agendados, error } = await supabase
      .from('agendamentos')
      .select('id')
      .eq('medico_id', medico.id)
      .eq('data_agendamento', dataCheckStr)
      .eq('cliente_id', clienteId)
      .gte('hora_agendamento', configPeriodo.inicio)
      .lte('hora_agendamento', configPeriodo.fim)
      .gte('data_agendamento', getMinimumBookingDate(config))
      .is('excluido_em', null)
      .in('status', ['agendado', 'confirmado']);
    
    if (error) {
      console.error(`❌ Erro ao verificar ${dataCheckStr}:`, error);
      continue;
    }
    
    const ocupadas = agendados?.length || 0;
    const disponiveis = configPeriodo.limite - ocupadas;
    
    if (disponiveis > 0) {
      const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const periodoNomes = { 'manha': 'Manhã', 'tarde': 'Tarde', 'noite': 'Noite' };
      
      datasEncontradas.push({
        data: dataCheckStr,
        dia_semana: diasSemana[diaSemanaNum],
        periodos: [{
          periodo: periodoNomes[periodo],
          horario_distribuicao: configPeriodo.distribuicao_fichas || `${configPeriodo.inicio} às ${configPeriodo.fim}`,
          vagas_disponiveis: disponiveis,
          total_vagas: configPeriodo.limite,
          tipo: 'ordem_chegada'
        }]
      });
      
      console.log(`✅ Encontrada: ${dataCheckStr} - ${disponiveis} vagas no período ${periodo}`);
      
      // Parar quando encontrar quantidade suficiente
      if (datasEncontradas.length >= quantidade) {
        break;
      }
    }
  }
  
  console.log(`📊 Total de datas encontradas com ${periodo}: ${datasEncontradas.length}`);
  return datasEncontradas;
}

// ============= HANDLER: HORÁRIOS DOS MÉDICOS =============

/**
 * Retorna os dias e horários de atendimento dos médicos da clínica
 * Lê diretamente das business_rules para garantir dados sempre atualizados
 */
async function handleDoctorSchedules(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    console.log('📥 [DOCTOR-SCHEDULES] Buscando horários para cliente:', clienteId);
    
    const { medico_nome, servico_nome } = body;
    
    // Buscar médicos ativos com convênios
    let query = supabase
      .from('medicos')
      .select('id, nome, especialidade, convenios_aceitos, ativo')
      .eq('cliente_id', clienteId)
      .eq('ativo', true)
      .order('nome');
    
    // Filtrar por nome do médico se fornecido
    if (medico_nome) {
      const nomeBusca = medico_nome.toLowerCase().trim();
      query = query.ilike('nome', `%${nomeBusca}%`);
    }
    
    const { data: medicos, error } = await query;
    
    if (error) {
      console.error('❌ Erro ao buscar médicos:', error);
      return errorResponse(`Erro ao buscar médicos: ${error.message}`);
    }
    
    if (!medicos || medicos.length === 0) {
      return successResponse({
        success: true,
        medicos: [],
        message: medico_nome 
          ? `Nenhum médico encontrado com o nome "${medico_nome}"`
          : 'Nenhum médico ativo encontrado',
        mensagem_whatsapp: medico_nome
          ? `Não encontrei nenhum médico com o nome "${medico_nome}". Deseja ver a lista completa de médicos?`
          : 'Não há médicos ativos no momento.'
      });
    }
    
    // Função helper para formatar dias da semana
    const formatarDias = (diasArray: number[]): string => {
      if (!diasArray || diasArray.length === 0) return 'Não definido';
      
      const diasOrdenados = [...diasArray].sort((a, b) => a - b);
      const diasNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const diasCompletos = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      
      // Verificar padrões comuns
      if (diasOrdenados.join(',') === '1,2,3,4,5') return 'Segunda a Sexta';
      if (diasOrdenados.join(',') === '1,2,3,4,5,6') return 'Segunda a Sábado';
      if (diasOrdenados.join(',') === '0,1,2,3,4,5,6') return 'Todos os dias';
      
      // Para 2 dias
      if (diasOrdenados.length === 2) {
        return `${diasCompletos[diasOrdenados[0]]} e ${diasCompletos[diasOrdenados[1]]}`;
      }
      
      // Para outros casos
      return diasOrdenados.map(d => diasNomes[d]).join(', ');
    };
    
    // Função helper para formatar dias abreviados (para WhatsApp)
    const formatarDiasAbreviado = (diasArray: number[]): string => {
      if (!diasArray || diasArray.length === 0) return '-';
      
      const diasOrdenados = [...diasArray].sort((a, b) => a - b);
      const diasAbrev = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      
      if (diasOrdenados.join(',') === '1,2,3,4,5') return 'Seg-Sex';
      if (diasOrdenados.join(',') === '1,2,3,4,5,6') return 'Seg-Sáb';
      if (diasOrdenados.join(',') === '0,1,2,3,4,5,6') return 'Todos';
      
      if (diasOrdenados.length === 2) {
        return `${diasAbrev[diasOrdenados[0]]}/${diasAbrev[diasOrdenados[1]]}`;
      }
      
      return diasOrdenados.map(d => diasAbrev[d]).join('/');
    };
    
    // Processar cada médico
    const medicosComHorarios = [];
    const mensagensWhatsApp: string[] = [];
    
    for (const medico of medicos) {
      // Obter business_rules do médico
      const regras = config?.business_rules?.[medico.id]?.config;
      
      if (!regras) {
        console.log(`⚠️ Sem business_rules para médico ${medico.nome}`);
        continue;
      }
      
      const servicos = regras.servicos || {};
      const tipoAgendamento = regras.tipo_agendamento || 'hora_marcada';
      const especialidade = medico.especialidade || regras.especialidade || '';
      
      const servicosProcessados: any[] = [];
      let linhasServico: string[] = [];
      
      // Processar cada serviço
      for (const [servicoKey, servicoConfig] of Object.entries(servicos as Record<string, any>)) {
        // Filtrar por nome do serviço se fornecido
        if (servico_nome) {
          const nomeBusca = servico_nome.toLowerCase().trim();
          const nomeServico = servicoConfig.nome?.toLowerCase() || servicoKey.toLowerCase();
          if (!nomeServico.includes(nomeBusca) && !servicoKey.toLowerCase().includes(nomeBusca)) {
            continue;
          }
        }
        
        const diasSemana = servicoConfig.dias_semana || [];
        const periodos = servicoConfig.periodos || {};
        const permiteOnline = servicoConfig.permite_agendamento_online !== false;
        const mensagemPersonalizada = servicoConfig.mensagem_pos_agendamento || '';
        
        // Processar períodos ativos
        const periodosAtivos: any[] = [];
        const periodosTexto: string[] = [];
        
        for (const [periodoNome, periodoConfig] of Object.entries(periodos as Record<string, any>)) {
          if (!periodoConfig.ativo) continue;
          
          // Normalizar período para pegar horários
          const periodoNorm = normalizarPeriodo(periodoConfig);
          
          const horarioInicio = periodoNorm.inicio || periodoNorm.contagem_inicio || periodoNorm.horario_inicio || '';
          const horarioFim = periodoNorm.fim || periodoNorm.contagem_fim || periodoNorm.horario_fim || '';
          const limite = periodoConfig.limite || periodoConfig.limite_pacientes || null;
          
          const periodoNomeFormatado = periodoNome === 'manha' ? 'Manhã' : 
                                        periodoNome === 'tarde' ? 'Tarde' : 
                                        periodoNome === 'noite' ? 'Noite' : periodoNome;
          
          periodosAtivos.push({
            periodo: periodoNomeFormatado,
            horario_inicio: horarioInicio,
            horario_fim: horarioFim,
            limite_pacientes: limite,
            tipo: tipoAgendamento === 'ordem_chegada' ? 'ordem_chegada' : 'hora_marcada'
          });
          
          // Formatar para texto
          if (horarioInicio && horarioFim) {
            periodosTexto.push(`${periodoNomeFormatado.toLowerCase()} ${horarioInicio}-${horarioFim}`);
          } else {
            periodosTexto.push(periodoNomeFormatado.toLowerCase());
          }
        }
        
        if (periodosAtivos.length === 0) continue;
        
        const servicoProcessado = {
          nome: servicoConfig.nome || servicoKey.replace(/_/g, ' '),
          key: servicoKey,
          tipo: servicoConfig.tipo || 'consulta',
          permite_agendamento_online: permiteOnline,
          dias_atendimento: formatarDias(diasSemana),
          dias_semana: diasSemana,
          periodos: periodosAtivos,
          tipo_agendamento: tipoAgendamento,
          mensagem_personalizada: mensagemPersonalizada || null
        };
        
        servicosProcessados.push(servicoProcessado);
        
        // Linha para WhatsApp
        const diasAbrev = formatarDiasAbreviado(diasSemana);
        const horariosTexto = periodosTexto.join(', ');
        const tipoTexto = tipoAgendamento === 'ordem_chegada' ? '(ordem de chegada)' : '';
        linhasServico.push(`   • ${servicoProcessado.nome}: ${diasAbrev} ${horariosTexto} ${tipoTexto}`.trim());
      }
      
      if (servicosProcessados.length === 0) continue;
      
      // Processar convênios do médico
      const conveniosRaw = medico.convenios_aceitos || regras.convenios_aceitos || [];
      const convenios = Array.isArray(conveniosRaw) ? conveniosRaw : [];
      
      // Formatar convênios para exibição
      const formatarConvenios = (convs: string[]): string => {
        if (!convs || convs.length === 0) return 'Não informado';
        if (convs.length <= 3) return convs.join(', ');
        return `${convs.slice(0, 3).join(', ')} e mais ${convs.length - 3}`;
      };
      
      medicosComHorarios.push({
        id: medico.id,
        nome: medico.nome,
        especialidade: especialidade,
        tipo_agendamento: tipoAgendamento,
        convenios_aceitos: convenios,
        convenios_texto: formatarConvenios(convenios),
        servicos: servicosProcessados
      });
      
      // Adicionar bloco para mensagem WhatsApp
      const icone = tipoAgendamento === 'ordem_chegada' ? '🏥' : '👨‍⚕️';
      const conveniosLinha = convenios.length > 0 
        ? `\n   💳 Convênios: ${formatarConvenios(convenios)}`
        : '';
      mensagensWhatsApp.push(`${icone} ${medico.nome}${especialidade ? ` (${especialidade})` : ''}${conveniosLinha}\n${linhasServico.join('\n')}`);
    }
    
    // Montar mensagem WhatsApp final
    let mensagemWhatsApp = '📅 *Horários de atendimento:*\n\n';
    mensagemWhatsApp += mensagensWhatsApp.join('\n\n');
    
    if (medicosComHorarios.length > 0) {
      mensagemWhatsApp += '\n\n💡 Posso ajudar a agendar com algum deles?';
    }
    
    console.log(`✅ [DOCTOR-SCHEDULES] ${medicosComHorarios.length} médico(s) com horários processados`);
    
    return successResponse({
      medicos: medicosComHorarios,
      total: medicosComHorarios.length,
      message: `Horários de atendimento de ${medicosComHorarios.length} médico(s)`,
      mensagem_whatsapp: mensagemWhatsApp,
      filtros_aplicados: {
        medico_nome: medico_nome || null,
        servico_nome: servico_nome || null
      }
    });
    
  } catch (error: any) {
    console.error('❌ [DOCTOR-SCHEDULES] Erro:', error);
    return errorResponse(`Erro ao buscar horários: ${error?.message || 'Erro desconhecido'}`);
  }
}

// ============= HANDLER: LISTAR MÉDICOS =============

async function handleListDoctors(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    console.log('📥 [LIST-DOCTORS] Buscando médicos para cliente:', clienteId);
    
    const { data: medicos, error } = await supabase
      .from('medicos')
      .select('id, nome, especialidade, convenios_aceitos, horarios, ativo, crm, rqe')
      .eq('cliente_id', clienteId)
      .eq('ativo', true)
      .order('nome');

    if (error) {
      console.error('❌ Erro ao buscar médicos:', error);
      return errorResponse(`Erro ao buscar médicos: ${error.message}`);
    }

    // Enriquecer com business_rules se disponíveis
    const medicosEnriquecidos = medicos?.map((medico: any) => {
      const rules = config?.business_rules?.[medico.id]?.config;
      return {
        id: medico.id,
        nome: medico.nome,
        especialidade: medico.especialidade || rules?.especialidade,
        convenios_aceitos: medico.convenios_aceitos,
        tipo_agendamento: rules?.tipo_agendamento || 'hora_marcada',
        servicos: rules?.servicos ? Object.keys(rules.servicos) : [],
        ativo: medico.ativo,
        crm: medico.crm,
        rqe: medico.rqe
      };
    }) || [];

    console.log(`✅ [LIST-DOCTORS] ${medicosEnriquecidos.length} médico(s) encontrado(s)`);

    return successResponse({
      message: `${medicosEnriquecidos.length} médico(s) disponível(is)`,
      medicos: medicosEnriquecidos,
      total: medicosEnriquecidos.length,
      cliente_id: clienteId
    });

  } catch (error: any) {
    console.error('❌ [LIST-DOCTORS] Erro:', error);
    return errorResponse(`Erro ao listar médicos: ${error?.message || 'Erro desconhecido'}`);
  }
}

// ============= HANDLER: INFORMAÇÕES DA CLÍNICA =============

async function handleClinicInfo(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    console.log('📥 [CLINIC-INFO] Buscando informações da clínica:', clienteId);

    // Usar principalmente a config dinâmica (llm_clinic_config)
    // Isso evita problemas de RLS com a tabela clientes
    if (config?.clinic_info) {
      const clinicInfo = {
        id: clienteId,
        nome: config.clinic_info.nome_clinica || 'Clínica',
        telefone: config.clinic_info.telefone,
        whatsapp: config.clinic_info.whatsapp,
        endereco: config.clinic_info.endereco,
        data_minima_agendamento: config.clinic_info.data_minima_agendamento || null,
        dias_busca_inicial: config.clinic_info.dias_busca_inicial || getDiasBuscaInicial(config),
        dias_busca_expandida: config.clinic_info.dias_busca_expandida || getDiasBuscaExpandida(config)
      };

      console.log(`✅ [CLINIC-INFO] Informações retornadas (via config): ${clinicInfo.nome}`);

      return successResponse({
        message: `Informações da clínica ${clinicInfo.nome}`,
        clinica: clinicInfo,
        cliente_id: clienteId,
        fonte: 'llm_clinic_config'
      });
    }

    // Fallback: tentar buscar da tabela clientes
    console.log('⚠️ [CLINIC-INFO] Config não disponível, tentando tabela clientes...');
    
    const { data: cliente, error } = await supabase
      .from('clientes')
      .select('id, nome, telefone, whatsapp, endereco')
      .eq('id', clienteId)
      .single();

    if (error) {
      console.warn('⚠️ Erro ao buscar cliente (retornando dados mínimos):', error.message);
      // Retornar dados mínimos em vez de erro
      return successResponse({
        message: 'Informações básicas da clínica',
        clinica: {
          id: clienteId,
          nome: 'Clínica',
          telefone: getClinicPhone(config),
          data_minima_agendamento: null,
          dias_busca_inicial: getDiasBuscaInicial(config),
          dias_busca_expandida: getDiasBuscaExpandida(config)
        },
        cliente_id: clienteId,
        fonte: 'fallback'
      });
    }

    const clinicInfo = {
      id: cliente?.id || clienteId,
      nome: cliente?.nome || 'Clínica',
      telefone: cliente?.telefone,
      whatsapp: cliente?.whatsapp,
      endereco: cliente?.endereco,
      data_minima_agendamento: null,
      dias_busca_inicial: getDiasBuscaInicial(config),
      dias_busca_expandida: getDiasBuscaExpandida(config)
    };

    console.log(`✅ [CLINIC-INFO] Informações retornadas (via clientes): ${clinicInfo.nome}`);

    return successResponse({
      message: `Informações da clínica ${clinicInfo.nome}`,
      clinica: clinicInfo,
      cliente_id: clienteId,
      fonte: 'clientes'
    });

  } catch (error: any) {
    console.error('❌ [CLINIC-INFO] Erro:', error);
    return errorResponse('Erro ao buscar informações. Tente novamente mais tarde.', 'CLINIC_INFO_ERROR');
  }
}

// Funções auxiliares
function successResponse(data: any) {
  return new Response(JSON.stringify({
    success: true,
    timestamp: new Date().toISOString(),
    ...data
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * 🆕 Retorna erro de VALIDAÇÃO DE NEGÓCIO (não erro técnico)
 * Status 200 para que n8n/LLM possa processar a resposta
 */
function businessErrorResponse(config: {
  codigo_erro: string;
  mensagem_usuario: string;
  detalhes?: any;
  sugestoes?: any;
}) {
  return new Response(JSON.stringify({
    success: false,
    codigo_erro: config.codigo_erro,
    mensagem_usuario: config.mensagem_usuario,
    mensagem_whatsapp: config.mensagem_usuario, // Compatibilidade
    detalhes: config.detalhes || {},
    sugestoes: config.sugestoes || null,
    timestamp: new Date().toISOString()
  }), {
    status: 200, // ✅ Status 200 para n8n processar
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function errorResponse(message: string, codigoErro = 'ERRO_GENERICO') {
  return new Response(JSON.stringify({
    success: false,
    codigo_erro: codigoErro,
    error: message,
    mensagem_usuario: message,
    mensagem_whatsapp: message,
    timestamp: new Date().toISOString()
  }), {
    status: 200, // ✅ Sempre 200 para n8n/agente processar JSON
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
