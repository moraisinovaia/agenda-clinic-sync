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
import { chatCompletion, OpenAIUnavailableError, OPENAI_FALLBACK_MESSAGE } from '../_lib/openai.ts';
import { checkAndIncrementQuota } from '../_lib/quota.ts';
import { checkRateLimitPersistent } from '../_lib/rate-limit.ts';
import { buildExtractionSystemPrompt } from '../_lib/prompts.ts';
import { handleAvailability, isBuscaProximaDisponibilidade } from './availability.ts';
import { handleSchedule } from './schedule.ts';
import { handleCancel } from './cancel.ts';
import { handleReschedule } from './reschedule.ts';
import { handleCheckPatient } from './check-patient.ts';
import { handleClinicInfo } from './clinic-info.ts';
import { maskPIIDeep } from '../_lib/pii.ts';

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
  // Contexto da consulta (P2). Hoje só "periodico" — paciente fazendo
  // check-up / consulta anual. Libera CASEMBRAPA (única exceção entre parceiros).
  tipo_atendimento_contexto: 'periodico' | null;
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
    tipo_atendimento_contexto: {
      type: ['string', 'null'],
      enum: ['periodico', null],
      description:
        'Contexto da consulta. "periodico" se o paciente mencionar consulta periódica, periódica, ' +
        'check-up, checkup, exame anual ou consulta anual. Caso contrário, null.',
    },
  },
  required: [
    'servico', 'medico_nome', 'medico_id', 'data_consulta', 'periodo',
    'convenio', 'nome_paciente', 'data_nascimento', 'confirmado',
    'tem_guia', 'fistula', 'peso', 'tipo_atendimento_contexto',
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

  // MAPA 24H: sempre exige guia
  if (isServicoMapa24h(dados.servico) && dados.tem_guia !== true) {
    if (!missing.includes('tem_guia')) missing.push('tem_guia');
  }

  // MRPA: exige guia apenas quando não é convênio particular
  if (isServicoMrpa(dados.servico) && !isConvenioParticular(dados.convenio) && dados.tem_guia !== true) {
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

// CASEMBRAPA tem regra diferente dos demais parceiros: BLOQUEIA para serviços
// normais, mas LIBERA quando o contexto é "periodico" (check-up anual).
// Cobre "CASEMBRAPA" e "CASEMBRAPA SAÚDE" (e variantes com espaço/acento)
// via normalização — basta o nome começar com "casembrapa" após normStr.
function isConvenioCasembrapa(convenio: string | null): boolean {
  if (!convenio) return false;
  return normStr(convenio).startsWith('casembrapa');
}

function isServicoTergo(servico: string | null): boolean {
  return !!servico && normStr(servico).includes('ergom');
}

function isServicoMapa(servico: string | null): boolean {
  return !!servico && normStr(servico).includes('mapa');
}

function isServicoMapa24h(servico: string | null): boolean {
  if (!servico) return false;
  const n = normStr(servico);
  return n.includes('mapa') && n.includes('24');
}

function isServicoMrpa(servico: string | null): boolean {
  if (!servico) return false;
  const n = normStr(servico);
  return n === 'mrpa' || n.includes('mrpa');
}

function isServicoMapaAmbiguo(servico: string | null): boolean {
  if (!servico) return false;
  return normStr(servico).includes('mapa') && !isServicoMapa24h(servico) && !isServicoMrpa(servico);
}

function isConvenioParticular(convenio: string | null): boolean {
  if (!convenio) return false;
  const n = normStr(convenio);
  return n.includes('particular') || n.includes('privado') ||
         n.includes('semconvenio') || n.includes('pagamentoparticular');
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
      tipo_atendimento_contexto: (m.tipo_atendimento_contexto as 'periodico' | null) ?? null,
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
    tipo_atendimento_contexto:
      (m.tipo_atendimento_contexto as 'periodico' | null) ?? null,
  };
}

// ── Phase 2: Auditoria determinística de regras de negócio ───────────────
// Backend tem autoridade total. Se blocked=true, override_response substitui
// a sugestão do LLM sem exceções.

function auditRules(
  dados: DadosColetados,
  intent: string,
  nextAction: string,
  mensagemOriginal?: string,
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

  // CASEMBRAPA: bloqueia salvo se contexto = periódico (check-up anual).
  // Aplica apenas em fluxos de scheduling (disponibilidade/agendar).
  if (
    isConvenioCasembrapa(dados.convenio) &&
    (intent === 'disponibilidade' || intent === 'agendar') &&
    dados.tipo_atendimento_contexto !== 'periodico'
  ) {
    return {
      blocked: true,
      override_response:
        `O convênio ${dados.convenio} é aceito apenas para consulta periódica (check-up anual). ` +
        `Se for o seu caso, posso ajudar a agendar. Caso contrário, oriente-se com a operadora ou agende como particular.`,
      reason: 'CASEMBRAPA_BLOCK',
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

  const ehIntentScheduling =
    intent === 'disponibilidade' || intent === 'agendar' ||
    nextAction === 'check_availability' || nextAction === 'execute_schedule';

  // Verificar se a mensagem original menciona "mapa" sem especificar "24" ou "mrpa"
  // (o LLM pode resolver "mapa" → "MAPA 24H", mas queremos a intenção do usuário)
  const msgN = mensagemOriginal ? normStr(mensagemOriginal) : null;
  const msgMapaAmbiguo = msgN
    ? msgN.includes('mapa') && !msgN.includes('24') && !msgN.includes('mrpa')
    : false;

  // MAPA ambíguo ("mapa" sem especificar 24H ou MRPA): pede tipo + guia em mensagem única
  if ((isServicoMapaAmbiguo(dados.servico) || msgMapaAmbiguo) && ehIntentScheduling) {
    return {
      blocked: true,
      override_response:
        'Você precisa fazer *MAPA 24H* ou *MRPA (MAPA de 4 dias)*? ' +
        'A guia médica normalmente informa isso. ' +
        'Pode enviar a foto da guia para eu verificar? ' +
        'Se for HGU, envie também a autorização.',
      reason: 'MAPA_AMBIGUO',
    };
  }

  // MAPA 24H sem guia
  if (isServicoMapa24h(dados.servico) && ehIntentScheduling && dados.tem_guia !== true) {
    return {
      blocked: true,
      override_response:
        'Para o *MAPA 24H*, é necessário ter a guia médica. ' +
        'Pode enviar a foto da guia para eu verificar? ' +
        'Se for HGU, envie também a autorização.',
      reason: 'MAPA_SEM_GUIA',
    };
  }

  // MRPA sem guia (apenas convênio — particular não precisa)
  if (
    isServicoMrpa(dados.servico) &&
    ehIntentScheduling &&
    !isConvenioParticular(dados.convenio) &&
    dados.tem_guia !== true
  ) {
    return {
      blocked: true,
      override_response:
        'Para o *MRPA*, é necessário ter a guia médica. ' +
        'Pode enviar a foto da guia para eu verificar? ' +
        'Se for HGU, envie também a autorização.',
      reason: 'MRPA_SEM_GUIA',
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

  if (nextAction === 'execute_reschedule') {
    // agendamento_id é responsabilidade do caller (n8n) — vem no body original.
    // nova_data prefere body; fallback para data_consulta extraída pela LLM.
    // nova_hora vem do body (EXTRACTION_SCHEMA atual não captura hora; manter
    // assim para não alterar comportamento dos demais fluxos).
    const agendamentoId = (baseBody as any)?.agendamento_id;
    const novaData      = (baseBody as any)?.nova_data ?? dados.data_consulta ?? undefined;
    const novaHora      = (baseBody as any)?.nova_hora ?? (baseBody as any)?.hora_consulta ?? undefined;
    const observacoes   = (baseBody as any)?.observacoes ?? undefined;

    if (!agendamentoId || !novaData || !novaHora) {
      return { handler: null, body: null };
    }

    return {
      handler: 'reschedule',
      body: {
        ...baseBody,
        agendamento_id: agendamentoId,
        nova_data:      novaData,
        nova_hora:      novaHora,
        observacoes,
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
    case 'reschedule':     return handleReschedule(supabase, body, clienteId, config);
    case 'check-patient':  return handleCheckPatient(supabase, body, clienteId, config);
    case 'clinic-info':    return handleClinicInfo(supabase, body, clienteId, config);
    default: return null;
  }
}

/**
 * [F-6] Parse defensivo da Response do handler interno. Se body não for JSON
 * válido (caso raro mas real — bug em algum handler), retorna shape de erro
 * estruturado em vez de propagar exception ao chat externo.
 */
async function safeHandlerJson(resp: Response): Promise<any> {
  try {
    return await resp.json();
  } catch (e) {
    console.error('[CHAT] Handler retornou body não-JSON:', (e as Error).message);
    return {
      success:         false,
      codigo_erro:     'HANDLER_RESPONSE_INVALID',
      mensagem_usuario: 'Tive um problema técnico ao processar essa ação. Vou transferir você para um atendente humano.',
    };
  }
}

// ── Helpers para o fluxo de remarcação via /chat ──────────────────────────

/**
 * Calcula campos faltando para despachar `execute_reschedule`.
 *
 * agendamento_id sempre vem do body (n8n conhece a conversa);
 * nova_data pode ser extraída pela LLM via dadosMerged.data_consulta;
 * nova_hora hoje precisa vir do body (LLM não captura hora).
 */
export function computeRescheduleMissing(
  body: any,
  dados: DadosColetados,
): string[] {
  const missing: string[] = [];
  if (!body?.agendamento_id) missing.push('agendamento_id');
  if (!(body?.nova_data ?? dados?.data_consulta)) missing.push('nova_data');
  if (!(body?.nova_hora ?? body?.hora_consulta)) missing.push('nova_hora');
  return missing;
}

const RESCHEDULE_FIELD_LABELS: Record<string, string> = {
  agendamento_id: 'a identificação do agendamento atual',
  nova_data:      'a nova data da consulta',
  nova_hora:      'o novo horário da consulta',
};

/** Mensagem humanizada listando o que ainda falta para remarcar. */
export function formatRescheduleAskMissing(missing: string[]): string {
  if (missing.length === 0) {
    return 'Para remarcar sua consulta, preciso de mais alguns dados.';
  }
  const partes = missing.map((m) => RESCHEDULE_FIELD_LABELS[m] ?? m);
  const lista = partes.length === 1
    ? partes[0]
    : partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1];
  return `Para remarcar sua consulta, ainda preciso de ${lista}. Pode me passar?`;
}

/**
 * Converte resposta do handler de reschedule em mensagem segura ao paciente.
 * Erros técnicos (codigo_erro=ERRO_GENERICO) são substituídos por mensagem genérica
 * para evitar vazar mensagens internas (ex.: nome de outro paciente em conflito).
 */
export function formatRescheduleHandlerResponse(hData: any, fallback: string): string {
  if (!hData) return fallback;
  if (hData.success === true) {
    return hData.message ?? hData.mensagem_whatsapp ?? hData.mensagem_usuario ?? fallback;
  }
  // success=false: businessErrorResponse traz codigo_erro específico; errorResponse usa ERRO_GENERICO.
  const codigo = hData.codigo_erro ?? 'ERRO_GENERICO';
  if (codigo !== 'ERRO_GENERICO' && (hData.mensagem_usuario || hData.mensagem_whatsapp)) {
    return hData.mensagem_whatsapp ?? hData.mensagem_usuario;
  }
  return 'Não consegui remarcar sua consulta agora. Vou encaminhar para nossa equipe continuar.';
}

// ── Exports para testes unitários ────────────────────────────────────────
export { auditRules, mergeDados, computeMissingFields, isServicoTergo, isServicoMapa, isServicoMapa24h, isServicoMrpa, isServicoMapaAmbiguo, isConvenioParticular, isConvenioParceiro, dispatchHandler };

// Seleciona a mensagem mais informativa de um resultado de handler.
// Cobre tanto successResponse (message) quanto businessErrorResponse (mensagem_usuario/whatsapp).
export function resolveHandlerMessage(hData: any, fallback: string): string {
  const selected =
    hData?.message          ? 'message' :
    hData?.mensagem_whatsapp ? 'mensagem_whatsapp' :
    hData?.mensagem_usuario  ? 'mensagem_usuario' :
    'fallback';
  console.warn('[RESOLVE_HANDLER_MESSAGE]', JSON.stringify({ selected, fallback }));
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

// ── Orquestrador determinístico de scheduling ─────────────────────────────
// Ativado somente para intent=agendar e intent=disponibilidade.
// Para outros intents retorna action='defer' e o dispatchHandler existente assume.

type PlanAction =
  | 'ask_missing'
  | 'check_next_availability'
  | 'check_availability_by_date'
  | 'confirm_schedule'
  | 'schedule'
  | 'handoff_human'
  | 'walk_in_info'
  | 'defer';

export interface SchedulingPlan {
  action:         PlanAction;
  resposta:       string;
  missing_fields: string[];
  dados:          DadosColetados;
  reason:         string;
}

export interface PlanInput {
  estadoAtual: string;
  mensagem:    string;
  extraction:  { intent: string; provided_fields: string[]; resposta: string; next_action: string };
  dadosMerged: DadosColetados;
  config:      DynamicConfig | null;
}

// Ordem fixa dos campos obrigatórios para agendamento.
export const OBRIGATORIOS_AGENDAR: (keyof DadosColetados)[] = ['convenio', 'data_consulta', 'nome_paciente'];

const ASK_LABELS: Record<string, string> = {
  convenio:      'Você possui convênio? Se sim, qual? Se preferir, pode responder "particular".',
  data_consulta: 'Qual dia você prefere para a consulta?',
  nome_paciente: 'Qual é o nome completo do paciente?',
};

// Retorna o campo 'tipo' do servico no config (ex: 'walk_in_info_only', 'fixed_time').
function getServicoTipoFromConfig(servico: string | null | undefined, config: DynamicConfig | null): string | null {
  if (!servico || !config?.business_rules) return null;
  const normalizar = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const nomeNorm = normalizar(servico);
  for (const medicoConfig of Object.values(config.business_rules)) {
    const servicos: Record<string, any> = (medicoConfig as any)?.config?.servicos ?? {};
    for (const [key, cfg] of Object.entries(servicos)) {
      const keyNorm = normalizar(key);
      if (keyNorm === nomeNorm || keyNorm.includes(nomeNorm) || nomeNorm.includes(keyNorm)) {
        return (cfg as any)?.tipo ?? null;
      }
    }
  }
  return null;
}

// Tenta preencher servico quando ausente: serviço único ou primeiro contendo "consulta".
function autoFillServicoPlan(dados: DadosColetados, config: DynamicConfig | null): void {
  if (dados.servico) return;
  if (!config?.business_rules) return;
  const entries = Object.values(config.business_rules);
  if (entries.length !== 1) return;
  const cfgServicos = entries[0].config?.servicos as Record<string, unknown> | undefined;
  if (!cfgServicos) return;
  const keys = Object.keys(cfgServicos);
  if (keys.length === 1) {
    dados.servico = keys[0];
    return;
  }
  const padrao = keys.find((k) => k.toLowerCase().includes('consulta'));
  if (padrao) dados.servico = padrao;
}

export function planSchedulingTurn({ estadoAtual: _estado, mensagem, extraction, dadosMerged, config }: PlanInput): SchedulingPlan {
  const { intent } = extraction;

  if (intent !== 'agendar' && intent !== 'disponibilidade') {
    return {
      action:         'defer',
      resposta:       extraction.resposta,
      missing_fields: [],
      dados:          dadosMerged,
      reason:         `intent=${intent} não é scheduling → dispatchHandler`,
    };
  }

  // Auto-fill servico para ambos os intents
  autoFillServicoPlan(dadosMerged, config);

  // ── Early: walk_in_info_only — orientar sem coletar campos de agendamento ─
  if (getServicoTipoFromConfig(dadosMerged.servico, config) === 'walk_in_info_only') {
    return {
      action:         'walk_in_info',
      resposta:       `O ${dadosMerged.servico} não precisa de agendamento prévio. O atendimento é por *ordem de chegada* — compareça diretamente nos dias disponíveis (manhã: Seg/Ter/Qui, tarde: Qua). Posso ajudar com mais alguma coisa?`,
      missing_fields: [],
      dados:          dadosMerged,
      reason:         `${dadosMerged.servico} é walk_in_info_only`,
    };
  }

  // ── intent = disponibilidade ─────────────────────────────────────────
  if (intent === 'disponibilidade') {
    if (!dadosMerged.servico || !dadosMerged.medico_nome) {
      const faltando = !dadosMerged.servico ? 'servico' : 'medico_nome';
      return {
        action:         'ask_missing',
        resposta:       faltando === 'servico' ? 'Qual serviço você deseja?' : 'Qual médico você deseja consultar?',
        missing_fields: [faltando],
        dados:          dadosMerged,
        reason:         `disponibilidade sem ${faltando} após auto-fill`,
      };
    }
    if (isBuscaProximaDisponibilidade(mensagem)) {
      return {
        action:         'check_next_availability',
        resposta:       '',
        missing_fields: [],
        dados:          dadosMerged,
        reason:         'intenção de próxima disponibilidade detectada na mensagem',
      };
    }
    if (dadosMerged.data_consulta) {
      return {
        action:         'check_availability_by_date',
        resposta:       '',
        missing_fields: [],
        dados:          dadosMerged,
        reason:         `disponibilidade para data específica: ${dadosMerged.data_consulta}`,
      };
    }
    return {
      action:         'check_next_availability',
      resposta:       '',
      missing_fields: [],
      dados:          dadosMerged,
      reason:         'disponibilidade sem data específica → check_next_availability por padrão',
    };
  }

  // ── intent = agendar ────────────────────────────────────────────────
  const missing = OBRIGATORIOS_AGENDAR.filter((f) => !dadosMerged[f]) as string[];

  if (missing.length > 0) {
    const first = missing[0];
    return {
      action:         'ask_missing',
      resposta:       ASK_LABELS[first] ?? `Por favor, informe ${first}.`,
      missing_fields: missing,
      dados:          dadosMerged,
      reason:         `campos obrigatórios faltando: ${missing.join(', ')}`,
    };
  }

  if (dadosMerged.confirmado === true) {
    return {
      action:         'schedule',
      resposta:       '',
      missing_fields: [],
      dados:          dadosMerged,
      reason:         'todos os obrigatórios + confirmado=true → executar agendamento',
    };
  }

  return {
    action:         'confirm_schedule',
    resposta:       extraction.resposta,
    missing_fields: [],
    dados:          dadosMerged,
    reason:         'todos os obrigatórios presentes, aguardando confirmação explícita',
  };
}

// ── Formata proximas_datas em mensagem WhatsApp para hybrid_capacity ─────────
// Garante que paciente veja: ordem de chegada, janela de comparecimento, data.
// Nunca expõe hora_agendamento interna como "às HH:MM".

function formatarDisponibilidadeParaWhatsApp(
  hData:       any,
  dadosMerged: DadosColetados,
  config:      DynamicConfig | null,
): string | null {
  if (hData?.sem_vagas) {
    return hData.message ?? 'Não encontrei vagas disponíveis. Entre em contato com a clínica.';
  }

  const datas: any[] | undefined = hData?.proximas_datas;
  if (!datas || datas.length === 0) return null;

  const nomeMedico =
    dadosMerged.medico_nome ??
    (config?.business_rules
      ? (Object.values(config.business_rules)[0] as any)?.medico_nome
      : null) ??
    'O médico';

  const DIA_CURTO: Record<string, string> = {
    'Segunda-feira': 'Segunda', 'Terça-feira': 'Terça',
    'Quarta-feira':  'Quarta',  'Quinta-feira': 'Quinta',
    'Sexta-feira':   'Sexta',   'Sábado':       'Sábado',
  };

  const isFixedTime = datas.some((dia: any) => dia.periodos?.some((p: any) => p.hora));

  const linhas: string[] = isFixedTime
    ? [`*MAPA 24H tem hora marcada* — compareça no horário indicado.\n`, `📅 *Vagas disponíveis:*`]
    : [`${nomeMedico} atende por *ordem de chegada* — sem hora marcada.\n`, `📅 *Vagas disponíveis:*`];

  for (const dia of datas) {
    const [, mes, d] = dia.data.split('-');
    const diaNome = DIA_CURTO[dia.dia_semana] ?? dia.dia_semana;
    for (const p of dia.periodos ?? []) {
      const vagas = p.vagas_disponiveis;
      if ((p as any).hora) {
        linhas.push(
          `• *${diaNome} (${d}/${mes})* — *às ${(p as any).hora}*` +
          ((p as any).chegar ? ` (chegue ${(p as any).chegar})` : '') +
          (typeof vagas === 'number' ? ` — ${vagas} vaga${vagas !== 1 ? 's' : ''}` : ''),
        );
      } else {
        const janela = p.horario_distribuicao ?? '';
        linhas.push(
          `• *${diaNome} (${d}/${mes})* — ${p.periodo}: compareça das ${janela}` +
          (typeof vagas === 'number' ? ` (${vagas} vaga${vagas !== 1 ? 's' : ''})` : ''),
        );
      }
    }
  }

  linhas.push('\nQual data prefere? Confirme e posso registrar seu atendimento.');
  return linhas.join('\n');
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

    // [H3] Rate limit autoritativo via Postgres antes do OpenAI. Atravessa
    // cold-starts e multi-instance. In-memory rate-limit do router fica
    // como 1ª linha de defesa pra todos os endpoints.
    const persistent = await checkRateLimitPersistent(supabase, clienteId);
    if (!persistent.allowed) {
      console.warn(`[CHAT] rate-limit persistente: ${clienteId} excedeu`);
      return successResponse({
        success:        true,
        action:         'response_only',
        resposta:       OPENAI_FALLBACK_MESSAGE,
        escalate_human: true,
        metadata:       { fallback_reason: 'rate_limit_persistent' },
      });
    }

    // [Daily cost guard] Cap atômico de calls OpenAI por tenant antes de
    // gastar tokens. Bug em integração (n8n loop) é hard-stopped aqui.
    const quota = await checkAndIncrementQuota(supabase, clienteId, 'openai');
    if (!quota.allowed) {
      console.warn(`[CHAT] quota OpenAI excedida pra ${clienteId}: ${quota.openai_calls}/${quota.limits?.openai}`);
      return successResponse({
        success:        true,
        action:         'response_only',
        resposta:       OPENAI_FALLBACK_MESSAGE,
        escalate_human: true,
        metadata:       {
          fallback_reason: 'daily_quota_exceeded',
          openai_calls:    quota.openai_calls,
          limit:           quota.limits?.openai,
        },
      });
    }

    const aiResult = await chatCompletion({
      messages,
      jsonSchemaName: 'chat_extraction',
      jsonSchema: EXTRACTION_SCHEMA,
      // [H2] Isolar falhas de OpenAI por tenant — não derrubar todos
      tenantKey: clienteId,
    });

    let extraction: ExtractionResult;
    try {
      extraction = JSON.parse(aiResult.content) as ExtractionResult;
    } catch {
      // [F-13] OpenAI ocasionalmente retorna JSON malformado (truncamento de
      // token, edge case do schema strict). Antes: errorResponse técnico que
      // o paciente WhatsApp via como "Resposta do modelo inválida..." e
      // abandonava. Agora: fallback humanizado consistente com OpenAIUnavailableError.
      console.error('[CHAT] Parse error (raw):', aiResult.content?.slice(0, 200));
      return successResponse({
        success:        true,
        action:         'response_only',
        resposta:       OPENAI_FALLBACK_MESSAGE,
        escalate_human: true,
        metadata:       { fallback_reason: 'openai_json_invalid' },
      });
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

    const audit        = auditRules(dadosMerged, extraction.intent, extraction.next_action, mensagem);

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

    // ── Phase 3: Orquestrador determinístico + dispatch ──────────────────
    let handlerResult: unknown = null;
    let acaoExecutada: string | null = null;
    let respostaFinal: string;

    if (audit.blocked) {
      respostaFinal = audit.override_response!;
      console.log(`[CHAT] Bloqueado por regra: ${audit.reason}`);
    } else {
      console.warn('[PLAN_INPUT]', JSON.stringify(maskPIIDeep({
        estadoAtual,
        mensagem,
        intent:      extraction.intent,
        next_action: extraction.next_action,
        dadosMerged,
      })));
      const plan = planSchedulingTurn({ estadoAtual, mensagem, extraction, dadosMerged, config });
      console.warn('[PLAN_OUTPUT]', JSON.stringify(plan));
      console.warn('[PHASE3_BRANCH]', JSON.stringify({ branch: plan.action }));

      if (plan.action === 'ask_missing') {
        // Nunca chama handler — responde com a pergunta determinística
        respostaFinal = plan.resposta;
        extraction.next_action = 'ask_missing';

      } else if (plan.action === 'check_next_availability' || plan.action === 'check_availability_by_date') {
        const availBody: Record<string, unknown> = {
          cliente_id:       clienteId,
          config_id:        body.config_id,
          phone_paciente:   body.phone_paciente,
          nome_paciente:    body.nome_paciente,
          mensagem_original: mensagem,
          medico_nome:      dadosMerged.medico_nome,
          medico_id:        dadosMerged.medico_id   ?? undefined,
          atendimento_nome: dadosMerged.servico,
          servico:          dadosMerged.servico,
          periodo:          dadosMerged.periodo      ?? undefined,
        };
        if (plan.action === 'check_next_availability') {
          availBody.buscar_proximas = true;
        } else {
          availBody.data_consulta = dadosMerged.data_consulta;
        }
        console.warn('[AVAILABILITY_CALL]', JSON.stringify(maskPIIDeep({ action: plan.action, body: availBody })));
        const resp = await callHandler('availability', supabase, availBody, clienteId, config);
        if (resp) {
          handlerResult = await safeHandlerJson(resp);
          acaoExecutada = 'availability';
          const hData = handlerResult as any;
          console.warn('[AVAILABILITY_RESULT]', JSON.stringify(maskPIIDeep({
            status:            hData?.status,
            success:           hData?.success,
            keys:              hData ? Object.keys(hData) : [],
            message:           hData?.message,
            mensagem_usuario:  hData?.mensagem_usuario,
            mensagem_whatsapp: hData?.mensagem_whatsapp,
            codigo_erro:       hData?.codigo_erro,
            raw:               hData,
          })));
          respostaFinal =
            formatarDisponibilidadeParaWhatsApp(hData, dadosMerged, config) ??
            resolveHandlerMessage(hData, extraction.resposta);
        } else {
          respostaFinal = extraction.resposta;
        }
        extraction.next_action = 'check_availability';

      } else if (plan.action === 'confirm_schedule') {
        extraction.next_action = 'confirm_schedule';
        respostaFinal = plan.resposta;  // LLM gerou o resumo dos dados

      } else if (plan.action === 'schedule') {
        const scheduleBody: Record<string, unknown> = {
          cliente_id:       clienteId,
          config_id:        body.config_id,
          phone_paciente:   body.phone_paciente,
          mensagem_original: mensagem,
          medico_nome:      dadosMerged.medico_nome,
          medico_id:        dadosMerged.medico_id    ?? undefined,
          atendimento_nome: dadosMerged.servico,
          servico:          dadosMerged.servico,
          data_consulta:    dadosMerged.data_consulta,
          periodo:          dadosMerged.periodo       ?? undefined,
          paciente_nome:    dadosMerged.nome_paciente,
          data_nascimento:  dadosMerged.data_nascimento ?? undefined,
          convenio:         dadosMerged.convenio,
        };
        const resp = await callHandler('schedule', supabase, scheduleBody, clienteId, config);
        if (resp) {
          handlerResult = await safeHandlerJson(resp);
          acaoExecutada = 'schedule';
          const hData = handlerResult as any;
          if (hData?.success === false) {
            console.warn('[CHAT] schedule erro:', {
              codigo_erro:      hData?.codigo_erro,
              mensagem_usuario: hData?.mensagem_usuario,
            });
          }
          respostaFinal = resolveHandlerMessage(hData, extraction.resposta);
        } else {
          respostaFinal = extraction.resposta;
        }
        extraction.next_action = 'execute_schedule';

      } else if (plan.action === 'walk_in_info') {
        respostaFinal = plan.resposta;
        extraction.next_action = 'walk_in_info';

      } else if (plan.action === 'handoff_human') {
        respostaFinal = 'Vou encaminhar sua solicitação para nossa equipe, que retornará em breve.';
        extraction.next_action = 'escalate_human';

      } else {
        // plan.action === 'defer': cancel, reschedule, clinic-info, info_geral, humano, etc.
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
            // Campos de remarcação propagados do body original (n8n).
            // Inertes para outros handlers (cancel/clinic-info ignoram).
            agendamento_id:    body.agendamento_id,
            nova_data:         body.nova_data,
            nova_hora:         body.nova_hora,
            hora_consulta:     body.hora_consulta,
            observacoes:       body.observacoes,
            // Propagar scope de médico para o handler de reschedule respeitar
            allowed_doctor_ids:   body.allowed_doctor_ids,
            doctor_scope:         body.doctor_scope,
            doctor_scope_ids:     body.doctor_scope_ids,
            medico_ids_permitidos: body.medico_ids_permitidos,
            allowed_doctor_names: body.allowed_doctor_names,
            doctor_scope_names:   body.doctor_scope_names,
            medico_nomes_permitidos: body.medico_nomes_permitidos,
          },
        );

        if (dispatch.handler && dispatch.body) {
          const resp = await callHandler(dispatch.handler, supabase, dispatch.body, clienteId, config);
          if (resp) {
            handlerResult = await safeHandlerJson(resp);
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
            // Reschedule usa formatador próprio para sanitizar erros técnicos.
            respostaFinal = dispatch.handler === 'reschedule'
              ? formatRescheduleHandlerResponse(hData, extraction.resposta)
              : resolveHandlerMessage(hData, extraction.resposta);
          } else {
            respostaFinal = extraction.resposta;
          }
        } else if (extraction.next_action === 'execute_reschedule') {
          // Sem handler porque faltam campos para remarcar — pedir ao paciente.
          const rescheduleMissing = computeRescheduleMissing(body, dadosMerged);
          if (rescheduleMissing.length > 0) {
            respostaFinal = formatRescheduleAskMissing(rescheduleMissing);
            extraction.next_action = 'ask_missing';
            missingFields = Array.from(new Set([...missingFields, ...rescheduleMissing]));
          } else {
            // Caso raríssimo: campos OK mas dispatch retornou null. Mantém UX segura.
            respostaFinal = 'Não consegui processar a remarcação agora. Vou encaminhar para nossa equipe.';
            extraction.next_action = 'escalate_human';
          }
        } else {
          // Sem handler — loop detection para estado verificando_disponibilidade
          if (
            estadoAtual === 'verificando_disponibilidade' &&
            extraction.next_action === 'check_availability'
          ) {
            if (extraction.provided_fields.length > 0) {
              respostaFinal = extraction.resposta;
              console.log('[CHAT] verificando_disponibilidade com dados novos — sem escalada');
            } else {
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

    // OpenAI indisponível mesmo após retry → fallback humanizado, sem expor erro técnico.
    // Mantém o formato esperado pelo n8n (campos do successResponse) e sinaliza
    // acao_executada='escalate_human' para o fluxo encaminhar a um atendente.
    if (err instanceof OpenAIUnavailableError || (err instanceof Error && err.name === 'OpenAIUnavailableError')) {
      const historicoOriginal = Array.isArray(body?.historico_contexto) ? body.historico_contexto : [];
      const dadosOriginais = body?.dados_coletados ?? {};
      const mensagemOriginal = typeof body?.mensagem === 'string' ? body.mensagem : '';
      return successResponse({
        resposta:           OPENAI_FALLBACK_MESSAGE,
        novo_estado:        'escalonado_humano',
        dados_coletados:    dadosOriginais,
        missing_fields:     [],
        historico_contexto: [
          ...historicoOriginal,
          { role: 'user',      content: mensagemOriginal },
          { role: 'assistant', content: OPENAI_FALLBACK_MESSAGE },
        ].slice(-20),
        acao_executada:     'escalate_human',
        handler_result:     null,
        tokens_used:        { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        _debug: {
          error_name:    'OpenAIUnavailableError',
          error_message: msg.slice(0, 200),
        },
      });
    }

    return errorResponse(`Erro no handler chat: ${msg}`);
  }
}
