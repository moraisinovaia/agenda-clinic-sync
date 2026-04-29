// =========================================================================
// /llm-agent-api/chat — handler conversacional WhatsApp
//
// Arquitetura em 4 fases bem separadas:
//   Phase 1 — EXTRACT  : OpenAI interpreta linguagem natural → schema estrito
//   Phase 2 — AUDIT    : backend aplica regras de negócio deterministicamente
//   Phase 3 — DISPATCH : backend decide qual handler chamar (nunca o LLM)
//   Phase 4 — FINALIZE : compõe resposta, atualiza estado e histórico
//
// Regex: SOMENTE para normalização de string (diacríticos, whitespace).
//        Nenhum regex como "cérebro" de intenção.
// =========================================================================

import type { DynamicConfig } from '../_lib/types.ts';
import { successResponse, errorResponse } from '../_lib/responses.ts';
import { chatCompletion } from '../_lib/openai.ts';
import { buildExtractionSystemPrompt } from '../_lib/prompts.ts';
import { handleAvailability } from './availability.ts';
import { handleSchedule } from './schedule.ts';
import { handleCancel } from './cancel.ts';
import { handleCheckPatient } from './check-patient.ts';
import { handleClinicInfo } from './clinic-info.ts';

// ── Interfaces ────────────────────────────────────────────────────────────

export interface DadosColetados {
  servico: string | null;
  medico_nome: string | null;
  medico_id: string | null;
  data_consulta: string | null;
  periodo: string | null;
  convenio: string | null;
  nome_paciente: string | null;
  data_nascimento: string | null;
  confirmado: boolean | null;
  tem_guia: boolean | null;
  fistula: boolean | null;
  peso: number | null;
}

interface ExtractionResult {
  intent: string;
  provided_fields: string[];
  missing_fields: string[];
  dados_extraidos: DadosColetados;
  next_action: string;
  confidence: number;
  resposta: string;
}

interface AuditOutcome {
  blocked: boolean;
  override_response: string | null;
  reason: string | null;
}

interface HandlerDecision {
  handler: string | null;
  body: Record<string, unknown> | null;
}

// ── JSON Schema para OpenAI Structured Output ─────────────────────────────
// Extrator semântico puro: o LLM nunca decide qual handler chamar.
// next_action usa vocabulário semântico, não nomes de implementação.

const DADOS_EXTRAIDOS_SCHEMA = {
  type: 'object',
  description:
    'Campos extraídos desta mensagem. Retornar null para campos não mencionados. ' +
    'Preservar valores anteriores — o backend faz o merge.',
  properties: {
    servico:         { type: ['string', 'null'], description: 'Nome do serviço desejado' },
    medico_nome:     { type: ['string', 'null'], description: 'Nome do médico mencionado' },
    medico_id:       { type: ['string', 'null'], description: 'UUID do médico (raro, omitir se desconhecido)' },
    data_consulta:   { type: ['string', 'null'], description: 'Data no formato YYYY-MM-DD' },
    periodo:         { type: ['string', 'null'], description: '"manha" | "tarde" | "qualquer"' },
    convenio:        { type: ['string', 'null'], description: 'Nome do convênio ou "particular"' },
    nome_paciente:   { type: ['string', 'null'], description: 'Nome completo do paciente' },
    data_nascimento: { type: ['string', 'null'], description: 'Data de nascimento YYYY-MM-DD' },
    confirmado:      { type: ['boolean', 'null'], description: 'true SOMENTE se o paciente confirmou explicitamente o agendamento' },
    tem_guia:        { type: ['boolean', 'null'], description: 'true se mencionou que tem guia médica' },
    fistula:         { type: ['boolean', 'null'], description: 'true se mencionou fístula no braço' },
    peso:            { type: ['number', 'null'],  description: 'Peso em kg, se mencionado' },
  },
  required: [
    'servico', 'medico_nome', 'medico_id', 'data_consulta', 'periodo',
    'convenio', 'nome_paciente', 'data_nascimento', 'confirmado',
    'tem_guia', 'fistula', 'peso',
  ],
};

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      description: 'Intenção principal detectada na mensagem',
      enum: [
        'disponibilidade',  // quer saber horários/vagas
        'agendar',          // quer marcar consulta/exame
        'cancelar',         // quer cancelar agendamento
        'remarcar',         // quer remarcar agendamento
        'preparo',          // pergunta sobre preparos/orientações
        'convenio',         // pergunta sobre convênios aceitos
        'nota_fiscal',      // pergunta sobre nota fiscal
        'info_geral',       // info sobre clínica (endereço, telefone, horários)
        'humano',           // quer falar com atendente humano
        'saudacao',         // saudação ou encerramento sem intenção específica
        'outro',
      ],
    },
    provided_fields: {
      type: 'array',
      items: { type: 'string' },
      description: 'Nomes dos campos que o usuário forneceu NESTA mensagem',
    },
    missing_fields: {
      type: 'array',
      items: { type: 'string' },
      description: 'Campos ainda necessários para completar a intenção atual',
    },
    dados_extraidos: DADOS_EXTRAIDOS_SCHEMA,
    next_action: {
      type: 'string',
      description: 'Próxima ação semântica necessária',
      enum: [
        'answer_info',        // responder pergunta informativa
        'ask_missing',        // solicitar dado que falta
        'check_availability', // verificar disponibilidade (tem serviço + médico)
        'confirm_schedule',   // pedir confirmação explícita antes de agendar
        'execute_schedule',   // executar agendamento (requer confirmado=true)
        'execute_cancel',     // executar cancelamento
        'execute_reschedule', // executar remarcação
        'escalate_human',     // transferir para atendente humano
        'close',              // encerrar conversa
      ],
    },
    confidence: {
      type: 'number',
      description: 'Confiança na extração de 0.0 a 1.0',
    },
    resposta: {
      type: 'string',
      description:
        'Resposta humanizada sugerida ao paciente. ' +
        'Tom educado, natural, português brasileiro. ' +
        'Será auditada pelo sistema: regras críticas têm prioridade sobre esta sugestão.',
    },
  },
  required: [
    'intent', 'provided_fields', 'missing_fields', 'dados_extraidos',
    'next_action', 'confidence', 'resposta',
  ],
};

// ── Campos obrigatórios por intenção ─────────────────────────────────────

const CAMPOS_AGENDAR: (keyof DadosColetados)[] = [
  'servico', 'medico_nome', 'data_consulta', 'nome_paciente', 'data_nascimento', 'convenio',
];
const CAMPOS_DISPONIBILIDADE: (keyof DadosColetados)[] = ['servico', 'medico_nome'];
const CAMPOS_CANCELAR: (keyof DadosColetados)[] = ['nome_paciente', 'data_nascimento'];

const CAMPO_LABELS: Record<string, string> = {
  servico:          'serviço desejado',
  medico_nome:      'nome do médico',
  data_consulta:    'data desejada',
  nome_paciente:    'nome completo',
  data_nascimento:  'data de nascimento',
  convenio:         'convênio (ou "particular")',
  tem_guia:         'guia médica para o MAPA',
  periodo:          'período (manhã ou tarde)',
  peso:             'seu peso em kg',
  fistula:          'se possui fístula no braço',
};

function computeMissingFields(intent: string, dados: DadosColetados): string[] {
  let required: (keyof DadosColetados)[] = [];

  if (intent === 'agendar') {
    required = CAMPOS_AGENDAR;
  } else if (intent === 'disponibilidade') {
    required = CAMPOS_DISPONIBILIDADE;
  } else if (intent === 'cancelar' || intent === 'remarcar') {
    required = CAMPOS_CANCELAR;
  } else {
    return [];
  }

  const missing: string[] = required.filter((f) => !dados[f]);

  // MAPA: exige guia médica antes de verificar disponibilidade ou agendar
  if (isServicoMapa(dados.servico) && dados.tem_guia !== true) {
    if (!missing.includes('tem_guia')) missing.push('tem_guia');
  }

  // Ergométrico: coletar peso e fístula ANTES de verificar disponibilidade ou agendar
  // Sem esses dados o agente não consegue validar as restrições clínicas
  if (isServicoTergo(dados.servico) && (intent === 'disponibilidade' || intent === 'agendar')) {
    if (dados.peso === null && !missing.includes('peso')) missing.push('peso');
    if (dados.fistula === null && !missing.includes('fistula')) missing.push('fistula');
  }

  return missing;
}

// ── Normalização (regex SOMENTE para texto, nunca para intenção) ──────────

function normStr(s: string): string {
  return s.toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')     // remove diacríticos
    .replace(/[\s-]/g, '');       // remove espaços e hífens
}

// Palavras-chave de intenção de scheduling — usadas para distinguir
// "Oi" (saudação pura) de "Oi, quero marcar consulta" (saudação + intenção).
const INTENCAO_SCHEDULING_NORM = [
  'agendar', 'agendamento', 'marcar', 'marcacao', 'consulta',
  'remarcar', 'remarcacao', 'cancelar', 'cancelamento',
  'disponibilidade', 'disponivel', 'horario', 'vaga',
];

export function contemIntencaoExplicita(mensagem: string): boolean {
  const n = normStr(mensagem);
  return INTENCAO_SCHEDULING_NORM.some((p) => n.includes(p));
}

const PARCEIROS_NORM = [
  'medprev', 'medclin', 'sedilab', 'clinicavida', 'clincenter', 'sertaosaude',
];

function isConvenioParceiro(convenio: string | null): boolean {
  if (!convenio) return false;
  const n = normStr(convenio);
  return PARCEIROS_NORM.some((p) => n.includes(p));
}

function isServicoTergo(servico: string | null): boolean {
  return !!servico && normStr(servico).includes('ergom');
}

function isServicoMapa(servico: string | null): boolean {
  return !!servico && normStr(servico).includes('mapa');
}

// ── Normalização de convênio ──────────────────────────────────────────────
// Mapeamento determinístico de palavras-chave para valor canônico.
// Apenas normalização — nunca usado para decidir intenção.

const CONVENIO_MAP: Array<[string, string]> = [
  ['particular', 'PARTICULAR'],
  ['unimed 40',  'UNIMED 40%'],
  ['unimed 20',  'UNIMED 20%'],
  ['hgu',        'HGU'],
  ['medprev',    'MEDPREV'],
];

function extractConvenioFromMessage(msg: string): string | null {
  const lower = msg.toLowerCase();
  for (const [pattern, value] of CONVENIO_MAP) {
    if (lower.includes(pattern)) return value;
  }
  return null;
}

// ── Normalização de data curta (DD/MM → YYYY-MM-DD) ──────────────────────
// Regex permitida: normalização de texto, nunca detecção de intenção.
// Captura DD/MM que NÃO seja seguido de separador + dígitos, evitando
// extrair o prefixo de datas completas como "15/05/1990".

function extractConsultaDateFromMessage(msg: string): string | null {
  const m = msg.match(/\b(\d{1,2})[\/\-](\d{1,2})(?![\/\-]\d)/);
  if (!m) return null;
  const day   = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const year = new Date().getFullYear();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ── Phase 2: Merge de dados coletados ────────────────────────────────────
// Valores null do LLM = "não mencionado neste turno" → preservar anterior.
// Valores não-null = override do anterior.

function mergeDados(
  anterior: Record<string, unknown>,
  extraido: DadosColetados | null | undefined,
): DadosColetados {
  const m: Record<string, unknown> = { ...anterior };
  // gpt-4o-mini com strict:false pode omitir dados_extraidos em mensagens sem campos
  if (!extraido) {
    return {
      servico: (m.servico as string | null) ?? null,
      medico_nome: (m.medico_nome as string | null) ?? null,
      medico_id: (m.medico_id as string | null) ?? null,
      data_consulta: (m.data_consulta as string | null) ?? null,
      periodo: (m.periodo as string | null) ?? null,
      convenio: (m.convenio as string | null) ?? null,
      nome_paciente: (m.nome_paciente as string | null) ?? null,
      data_nascimento: (m.data_nascimento as string | null) ?? null,
      confirmado: (m.confirmado as boolean | null) ?? null,
      tem_guia: (m.tem_guia as boolean | null) ?? null,
      fistula: (m.fistula as boolean | null) ?? null,
      peso: (m.peso as number | null) ?? null,
    };
  }
  for (const [k, v] of Object.entries(extraido)) {
    if (v !== null && v !== undefined) m[k] = v;
  }
  return {
    servico:         (m.servico         as string  | null) ?? null,
    medico_nome:     (m.medico_nome     as string  | null) ?? null,
    medico_id:       (m.medico_id       as string  | null) ?? null,
    data_consulta:   (m.data_consulta   as string  | null) ?? null,
    periodo:         (m.periodo         as string  | null) ?? null,
    convenio:        (m.convenio        as string  | null) ?? null,
    nome_paciente:   (m.nome_paciente   as string  | null) ?? null,
    data_nascimento: (m.data_nascimento as string  | null) ?? null,
    confirmado:      (m.confirmado      as boolean | null) ?? null,
    tem_guia:        (m.tem_guia        as boolean | null) ?? null,
    fistula:         (m.fistula         as boolean | null) ?? null,
    peso:            (m.peso            as number  | null) ?? null,
  };
}

// ── Phase 2: Auditoria determinística de regras de negócio ───────────────
// Backend tem autoridade total. Se blocked=true, override_response substitui
// a sugestão do LLM sem exceções.

function auditRules(
  dados: DadosColetados,
  intent: string,
  nextAction: string,
): AuditOutcome {
  // Convênio parceiro: nunca agendar diretamente
  if (isConvenioParceiro(dados.convenio)) {
    return {
      blocked: true,
      override_response:
        `Para o convênio ${dados.convenio}, orientamos entrar em contato diretamente com a operadora ou realizar o agendamento como particular. Posso ajudar com mais alguma coisa?`,
      reason: 'CONVENIO_PARCEIRO',
    };
  }

  // Teste Ergométrico — fístula
  if (isServicoTergo(dados.servico) && dados.fistula === true) {
    return {
      blocked: true,
      override_response:
        'Pacientes com fístula no braço não podem realizar o Teste Ergométrico. Por favor, consulte o médico.',
      reason: 'FISTULA_BLOCK',
    };
  }

  // Teste Ergométrico — peso acima de 150 kg
  if (isServicoTergo(dados.servico) && dados.peso !== null && dados.peso > 150) {
    return {
      blocked: true,
      override_response:
        `O limite de peso para o Teste Ergométrico é 150 kg. O peso informado (${dados.peso} kg) excede o permitido. Por favor, consulte o médico.`,
      reason: 'PESO_BLOCK',
    };
  }

  // MAPA — guia médica obrigatória antes de mostrar disponibilidade ou agendar
  const precisaGuiaMapa =
    isServicoMapa(dados.servico) &&
    (intent === 'disponibilidade' || intent === 'agendar' ||
      nextAction === 'check_availability' || nextAction === 'execute_schedule') &&
    dados.tem_guia !== true;

  if (precisaGuiaMapa) {
    return {
      blocked: true,
      override_response:
        'Para o MAPA 24H, é necessário ter a guia médica em mãos. Você já possui a guia?',
      reason: 'MAPA_SEM_GUIA',
    };
  }

  return { blocked: false, override_response: null, reason: null };
}

// ── Phase 3: Dispatch determinístico de handlers ──────────────────────────
// O backend mapeia next_action semântico → handler de implementação.
// O LLM nunca decide qual handler invocar.

function dispatchHandler(
  nextAction: string,
  intent: string,
  dados: DadosColetados,
  baseBody: Record<string, unknown>,
): HandlerDecision {
  if (nextAction === 'check_availability' && dados.servico && dados.medico_nome) {
    return {
      handler: 'availability',
      body: {
        ...baseBody,
        medico_nome:      dados.medico_nome,
        medico_id:        dados.medico_id    ?? undefined,
        // handlers usam atendimento_nome; servico enviado como alias de segurança
        atendimento_nome: dados.servico,
        servico:          dados.servico,
        data_consulta:    dados.data_consulta ?? undefined,
        periodo:          dados.periodo       ?? undefined,
      },
    };
  }

  // execute_schedule EXIGE confirmado=true (guarda dupla: LLM + backend)
  if (
    nextAction === 'execute_schedule' &&
    dados.confirmado === true &&
    dados.servico &&
    dados.medico_nome
  ) {
    return {
      handler: 'schedule',
      body: {
        ...baseBody,
        medico_nome:      dados.medico_nome,
        medico_id:        dados.medico_id       ?? undefined,
        // handlers usam atendimento_nome; servico enviado como alias de segurança
        atendimento_nome: dados.servico,
        servico:          dados.servico,
        data_consulta:    dados.data_consulta   ?? undefined,
        periodo:          dados.periodo         ?? undefined,
        paciente_nome:    dados.nome_paciente   ?? undefined,
        data_nascimento:  dados.data_nascimento ?? undefined,
        convenio:         dados.convenio        ?? undefined,
      },
    };
  }

  if (nextAction === 'execute_cancel') {
    return {
      handler: 'cancel',
      body: {
        ...baseBody,
        paciente_nome:   dados.nome_paciente   ?? undefined,
        data_nascimento: dados.data_nascimento ?? undefined,
      },
    };
  }

  if (intent === 'info_geral' && nextAction === 'answer_info') {
    return { handler: 'clinic-info', body: { ...baseBody } };
  }

  return { handler: null, body: null };
}

// ── Phase 4: Estado derivado da next_action ───────────────────────────────

function deriveEstado(
  nextAction: string,
  intent: string,
  estadoAtual: string,
): string {
  if (intent === 'outro') return estadoAtual;
  if (intent === 'saudacao') return 'identificando_servico';
  const map: Record<string, string> = {
    ask_missing:          estadoAtual === 'inicio' ? 'identificando_servico' : estadoAtual,
    check_availability:   'verificando_disponibilidade',
    confirm_schedule:     'confirmando_dados',
    execute_schedule:     'agendado',
    execute_cancel:       'cancelando',
    execute_reschedule:   'remarcando',
    escalate_human:       'escalonado_humano',
    close:                'encerrada',
    answer_info:          estadoAtual,
  };
  return map[nextAction] ?? estadoAtual;
}

// ── Auxiliar: invocar handler existente ──────────────────────────────────

async function callHandler(
  handler: string,
  supabase: any,
  body: Record<string, unknown>,
  clienteId: string,
  config: DynamicConfig | null,
): Promise<Response | null> {
  switch (handler) {
    case 'availability':   return handleAvailability(supabase, body, clienteId, config);
    case 'schedule':       return handleSchedule(supabase, body, clienteId, config);
    case 'cancel':         return handleCancel(supabase, body, clienteId, config);
    case 'check-patient':  return handleCheckPatient(supabase, body, clienteId, config);
    case 'clinic-info':    return handleClinicInfo(supabase, body, clienteId, config);
    default: return null;
  }
}

// ── Exports para testes unitários ────────────────────────────────────────
export { auditRules, mergeDados, computeMissingFields, isServicoTergo, isServicoMapa, isConvenioParceiro, dispatchHandler };

// Seleciona a mensagem mais informativa de um resultado de handler.
// Cobre tanto successResponse (message) quanto businessErrorResponse (mensagem_usuario/whatsapp).
export function resolveHandlerMessage(hData: any, fallback: string): string {
  return hData?.message ?? hData?.mensagem_whatsapp ?? hData?.mensagem_usuario ?? fallback;
}

// ── Camada final de normalização e segurança ──────────────────────────────
// Executada imediatamente antes do successResponse.
// Garante invariantes de domínio sem alterar o fluxo principal.

const FALLBACK_HUMANO =
  'Desculpe, tive uma instabilidade ao processar sua solicitação. ' +
  'Vou encaminhar para a equipe continuar o atendimento.';

export const OBRIGATORIOS_CONSULTA: (keyof DadosColetados)[] = [
  'nome_paciente', 'data_consulta', 'convenio',
];

export function finalizeResponse(params: {
  respostaFinal: string;
  dadosMerged: DadosColetados;
  missingFields: string[];
  novoEstado: string;
  config: DynamicConfig | null;
  intent: string;
}): { respostaFinal: string; missingFields: string[]; novoEstado: string } {
  let { respostaFinal, missingFields, novoEstado } = params;
  const { dadosMerged, config, intent } = params;

  // Regra 4: médico único — segundo nível de segurança após auto-fill principal
  if (!dadosMerged.medico_nome && config?.business_rules) {
    const entries = Object.values(config.business_rules);
    if (entries.length === 1 && entries[0].medico_nome) {
      console.warn('[CHAT] finalizeResponse: medico_nome null com médico único — corrigindo');
      dadosMerged.medico_nome = entries[0].medico_nome as string;
      if (entries[0].medico_id) {
        dadosMerged.medico_id = entries[0].medico_id as string;
      }
      // Paciente nunca deve ser perguntado sobre médico em canal de médico único
      missingFields = missingFields.filter((f) => f !== 'medico_nome');
    }
  }

  // Regras 5 + 6: missing_fields com campos reais do domínio (consulta)
  if (intent === 'agendar') {
    const realMissing = OBRIGATORIOS_CONSULTA.filter((f) => !dadosMerged[f]);
    const uncovered = realMissing.filter((f) => !missingFields.includes(f));

    if (uncovered.length > 0) {
      const wasEmpty = missingFields.length === 0;
      console.warn(
        `[CHAT] finalizeResponse: campos obrigatórios null fora de missing_fields: ${uncovered.join(', ')}`,
      );
      missingFields = [...new Set([...missingFields, ...uncovered])];

      if (wasEmpty) {
        // Regra 6: missing_fields estava [] mas há campos nulos — ajustar estado e perguntar
        const ESTADOS_COLETA = ['coletando_dados', 'identificando_servico', 'confirmando_dados'];
        if (!ESTADOS_COLETA.includes(novoEstado) && novoEstado !== 'escalonado_humano') {
          novoEstado = 'coletando_dados';
        }
        const label = CAMPO_LABELS[uncovered[0]] ?? uncovered[0];
        respostaFinal = `Para continuar com o agendamento, preciso saber: qual é o seu ${label}?`;
      }
    }
  }

  // Regras 3 + 7: resposta nunca vazia — último recurso
  if (!respostaFinal?.trim()) {
    console.warn(
      `[CHAT] finalizeResponse: resposta vazia detectada (intent=${intent}, estado=${novoEstado})`,
    );
    respostaFinal = FALLBACK_HUMANO;
    if (novoEstado !== 'escalonado_humano') {
      novoEstado = 'escalonado_humano';
    }
  }

  return { respostaFinal, missingFields, novoEstado };
}

// ── Handler principal ──────────────────────────────────────────────────────

export async function handleChat(
  supabase: any,
  body: any,
  clienteId: string,
  config: DynamicConfig | null,
): Promise<Response> {
  try {
    // Early exit: imagens (GAP-001 — visão não implementada)
    if (body.messageType === 'image') {
      return successResponse({
        resposta:
          'Recebi uma imagem, mas nossa equipe precisará verificar. ' +
          'Pode descrever sua dúvida por texto ou aguarde nosso retorno.',
        novo_estado:        body.estado_atual  ?? 'inicio',
        dados_coletados:    body.dados_coletados ?? {},
        historico_contexto: body.historico_contexto ?? [],
        acao_executada:     null,
        handler_result:     null,
        tokens_used:        null,
      });
    }

    const mensagem: string = body.mensagem;
    if (!mensagem) return errorResponse('Campo "mensagem" é obrigatório');

    const estadoAtual: string                              = body.estado_atual       ?? 'inicio';
    const dadosAnteriores: Record<string, unknown>         = body.dados_coletados    ?? {};
    const historicoContexto: Array<{ role: string; content: string }> =
      body.historico_contexto ?? [];

    // Auto-fill médico único: config com 1 médico nunca pergunta "qual médico?"
    // Feito ANTES do prompt para que DADOS JÁ COLETADOS já mostre o médico ao LLM.
    const dadosComPrefill: Record<string, unknown> = { ...dadosAnteriores };
    if (!dadosComPrefill.medico_nome && config?.business_rules) {
      const medicoEntries = Object.values(config.business_rules);
      if (medicoEntries.length === 1) {
        dadosComPrefill.medico_nome = medicoEntries[0].medico_nome;
        dadosComPrefill.medico_id   = medicoEntries[0].medico_id;
        console.log(`[CHAT] medico auto-fill: ${medicoEntries[0].medico_nome}`);
      }
    }
    // Auto-fill serviço único: verificado independentemente do médico já estar preenchido,
    // para garantir fill em todos os turnos da conversa.
    if (!dadosComPrefill.servico && config?.business_rules) {
      const medicoEntries = Object.values(config.business_rules);
      if (medicoEntries.length === 1) {
        const cfgServicos = medicoEntries[0].config?.servicos;
        if (cfgServicos) {
          const nomeServicos = Object.keys(cfgServicos);
          if (nomeServicos.length === 1) {
            dadosComPrefill.servico = nomeServicos[0];
            console.log(`[CHAT] servico auto-fill: ${nomeServicos[0]}`);
          }
        }
      }
    }

    // ── Phase 1: Extração semântica via OpenAI ────────────────────────────
    const systemPrompt = buildExtractionSystemPrompt(config, estadoAtual, dadosComPrefill);

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...historicoContexto.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: mensagem },
    ];

    const aiResult = await chatCompletion({
      messages,
      jsonSchemaName: 'chat_extraction',
      jsonSchema: EXTRACTION_SCHEMA,
    });

    let extraction: ExtractionResult;
    try {
      extraction = JSON.parse(aiResult.content) as ExtractionResult;
    } catch {
      console.error('[CHAT] Parse error:', aiResult.content?.slice(0, 200));
      return errorResponse('Resposta do modelo inválida. Tente novamente.');
    }

    console.log(`[CHAT] intent=${extraction.intent} next_action=${extraction.next_action} confidence=${extraction.confidence}`);

    // ── Phase 2: Merge + normalização + auditoria de regras de negócio ──────
    const dadosMerged  = mergeDados(dadosComPrefill, extraction.dados_extraidos);

    // Normalizar data_consulta se o LLM não converteu formato curto (DD/MM)
    if (!dadosMerged.data_consulta) {
      const dateFromMsg = extractConsultaDateFromMessage(mensagem);
      if (dateFromMsg) {
        dadosMerged.data_consulta = dateFromMsg;
        console.log(`[CHAT] data_consulta normalizada do texto: ${dateFromMsg}`);
      }
    }

    // Normalizar convênio: busca na mensagem + no valor já extraído pelo LLM.
    // Garante formato canônico independentemente de o LLM ter preenchido ou não.
    {
      const source = mensagem + ' ' + (dadosMerged.convenio ?? '');
      const convenioNorm = extractConvenioFromMessage(source);
      if (convenioNorm) {
        dadosMerged.convenio = convenioNorm;
        console.log(`[CHAT] convenio normalizado: ${convenioNorm}`);
      }
    }

    // ── Overrides contextuais determinísticos ────────────────────────────
    // Backend interpreta mensagens curtas pelo estado atual — sem depender do LLM.
    {
      const msgLower = mensagem.toLowerCase().trim().replace(/[!?.]/g, '');
      const isConfirmacao = /^(sim|ok|pode|pode ser|confirmo|confirmado|isso|exato|claro|s|certo|perfeito|vai|vamos|bora)$/.test(msgLower);
      const isCobrandoEspera = /cad[eê]|onde est|quanto tem|estou esperand|demor(ou|ando)|aguardando|esperand/.test(mensagem.toLowerCase());

      if (estadoAtual === 'confirmando_dados' && isConfirmacao) {
        extraction.intent      = 'agendar';
        extraction.next_action = 'execute_schedule';
        dadosMerged.confirmado  = true;
        console.log('[CHAT] override: confirmação contextual em confirmando_dados');
      }

      if (isCobrandoEspera) {
        extraction.intent      = 'humano';
        extraction.next_action = 'escalate_human';
        extraction.resposta    =
          'Peço desculpas pela demora! Vou encaminhar seu atendimento para nossa equipe, que entrará em contato em breve.';
        console.log('[CHAT] override: cobrança de espera → escalate_human');
      }
    }

    const audit        = auditRules(dadosMerged, extraction.intent, extraction.next_action);

    // ── Saudação: forçar início do fluxo de coleta ───────────────────────
    // Aplica somente quando é saudação pura: sem campos extraídos e sem intenção
    // explícita na mensagem. "Oi, quero marcar consulta" → segue como agendar.
    if (
      extraction.intent === 'saudacao' &&
      extraction.provided_fields.length === 0 &&
      !contemIntencaoExplicita(mensagem)
    ) {
      extraction.next_action = 'ask_missing';
      const nomeclinica = config?.clinic_info?.nome_clinica ?? 'nossa clínica';
      extraction.resposta =
        `Olá! Seja bem-vindo(a) à ${nomeclinica}. Como posso ajudá-lo(a) hoje? ` +
        `Gostaria de agendar, remarcar ou cancelar um atendimento? Ou tem alguma dúvida?`;
    }

    // ── Recalcular missing_fields deterministicamente ────────────────────
    // Backend conhece os dados reais após merge; não confiar no LLM.
    let missingFields = computeMissingFields(extraction.intent, dadosMerged);

    // Se todos os campos obrigatórios estão preenchidos e a intent é agendar,
    // forçar confirm_schedule independentemente do que o LLM sugeriu.
    if (
      missingFields.length === 0 &&
      extraction.intent === 'agendar' &&
      extraction.next_action === 'ask_missing' &&
      dadosMerged.confirmado !== true
    ) {
      extraction.next_action = 'confirm_schedule';
    }

    // ── Phase 3: Dispatch de handler (somente se não bloqueado) ──────────
    let handlerResult: unknown = null;
    let acaoExecutada: string | null = null;
    let respostaFinal: string;

    if (audit.blocked) {
      // Regra crítica acionada: resposta determinística, sem handler
      respostaFinal = audit.override_response!;
      console.log(`[CHAT] Bloqueado por regra: ${audit.reason}`);
    } else {
      const dispatch = dispatchHandler(
        extraction.next_action,
        extraction.intent,
        dadosMerged,
        {
          cliente_id:        clienteId,
          config_id:         body.config_id,
          phone_paciente:    body.phone_paciente,
          nome_paciente:     body.nome_paciente,
          mensagem_original: mensagem,
        },
      );

      if (dispatch.handler && dispatch.body) {
        const resp = await callHandler(dispatch.handler, supabase, dispatch.body, clienteId, config);
        if (resp) {
          handlerResult = await resp.json();
          acaoExecutada = dispatch.handler;
          const hData = handlerResult as any;
          if (hData?.success === false) {
            console.warn('[CHAT] handler retornou erro:', {
              handler:           dispatch.handler,
              codigo_erro:       hData?.codigo_erro,
              mensagem_usuario:  hData?.mensagem_usuario,
              mensagem_whatsapp: hData?.mensagem_whatsapp,
            });
          }
          respostaFinal = resolveHandlerMessage(hData, extraction.resposta);
        } else {
          respostaFinal = extraction.resposta;
        }
      } else {
        // Sem handler disponível
        if (
          estadoAtual === 'verificando_disponibilidade' &&
          extraction.next_action === 'check_availability'
        ) {
          if (extraction.provided_fields.length > 0) {
            // Paciente forneceu dados novos neste turno — não é loop real.
            // Manter o fluxo; o próximo turno terá os dados para despachar.
            respostaFinal = extraction.resposta;
            console.log('[CHAT] verificando_disponibilidade com dados novos — sem escalada');
          } else {
            // Nenhum dado novo e handler continua falhando — loop real.
            respostaFinal =
              'Vou encaminhar sua solicitação para nossa equipe verificar os horários disponíveis e retornar com as opções em breve.';
            extraction.next_action = 'escalate_human';
            console.log('[CHAT] override: loop verificando_disponibilidade → escalate_human');
          }
        } else {
          respostaFinal = extraction.resposta;
        }
      }
    }

    // ── Phase 4: Estado + histórico ──────────────────────────────────────
    let novoEstado = audit.blocked
      ? estadoAtual   // bloqueio por regra não avança o estado
      : deriveEstado(extraction.next_action, extraction.intent, estadoAtual);

    ({ respostaFinal, missingFields, novoEstado } = finalizeResponse({
      respostaFinal,
      dadosMerged,
      missingFields,
      novoEstado,
      config,
      intent: extraction.intent,
    }));

    const historicoAtualizado = [
      ...historicoContexto,
      { role: 'user',      content: mensagem },
      { role: 'assistant', content: respostaFinal },
    ].slice(-20);   // janela deslizante de 20 mensagens (10 turnos)

    return successResponse({
      resposta:           respostaFinal,
      novo_estado:        novoEstado,
      dados_coletados:    dadosMerged,
      missing_fields:     missingFields,   // calculado deterministicamente no backend
      historico_contexto: historicoAtualizado,
      acao_executada:     acaoExecutada,
      handler_result:     handlerResult,
      tokens_used:        aiResult.usage,
      _debug: {
        intent:                extraction.intent,
        next_action:           extraction.next_action,
        confidence:            extraction.confidence,
        provided_fields:       extraction.provided_fields,
        missing_fields_llm:    extraction.missing_fields,   // para comparação/auditoria
        missing_fields_real:   missingFields,
        audit_reason:          audit.reason,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[CHAT] Erro:', msg);
    return errorResponse(`Erro no handler chat: ${msg}`);
  }
}
