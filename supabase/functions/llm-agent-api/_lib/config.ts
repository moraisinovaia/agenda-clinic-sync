// ============= CONFIG, CACHE, buscarAgendaDedicada, normalizarPeriodo =============

import type { DynamicConfig, ConfigCache } from './types.ts'

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
export async function buscarAgendaDedicada(
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

export const CONFIG_CACHE: Map<string, ConfigCache> = new Map();
export const CACHE_TTL_MS = 1 * 60 * 1000; // 1 minuto - alterações aplicam em no máximo 60 segundos

export function isCacheValid(clienteId: string): boolean {
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
export async function loadDynamicConfig(supabase: any, clienteId: string, configId?: string): Promise<DynamicConfig | null> {
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
export function normalizarPeriodo(periodo: any): any {
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
export function normalizarServicoPeriodos(servico: any): any {
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
