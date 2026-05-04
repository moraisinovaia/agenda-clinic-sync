// ============= VALIDAÇÃO DE SCHEMA DE REQUEST =============
//
// Validação leve aplicada antes do dispatch pra cada handler. Sem dependência
// externa (Zod adicionaria 50KB+ ao bundle do Edge Function). Cobre os
// erros mais comuns:
//   - tipo errado (string em vez de número, etc)
//   - UUID malformado
//   - data fora do formato YYYY-MM-DD ou DD/MM/YYYY
//   - campos obrigatórios ausentes
//
// Cada validador é puro e retorna `null` quando passa, ou string com a
// descrição do erro. O caller acumula e retorna 400 com lista detalhada.

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const BR_DATE_REGEX  = /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export interface FieldError {
  field:   string;
  rule:    string;
  message: string;
}

export class SchemaError extends Error {
  constructor(public errors: FieldError[]) {
    super(`Schema validation falhou: ${errors.length} erro(s)`);
    this.name = 'SchemaError';
  }
}

// ── Validadores primitivos ─────────────────────────────────────────────

export function isUuid(v: unknown): boolean {
  return typeof v === 'string' && UUID_REGEX.test(v);
}

export function isIsoOrBrDate(v: unknown): boolean {
  return typeof v === 'string' && (ISO_DATE_REGEX.test(v) || BR_DATE_REGEX.test(v));
}

export function isHora(v: unknown): boolean {
  return typeof v === 'string' && HORA_REGEX.test(v);
}

export function isNonEmptyString(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

export function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

// ── Validadores de objeto ──────────────────────────────────────────────

/**
 * Valida o body comum a todos os endpoints product:
 *   - cliente_id obrigatório (uuid)
 *   - config_id opcional (uuid)
 *   - allowed_doctor_ids opcional (string[])
 */
export function validateBaseRequest(body: any): FieldError[] {
  const errs: FieldError[] = [];
  if (body === null || typeof body !== 'object') {
    errs.push({ field: '$', rule: 'body_object', message: 'body deve ser um objeto JSON' });
    return errs;
  }
  if (!body.cliente_id) {
    errs.push({ field: 'cliente_id', rule: 'required', message: 'cliente_id é obrigatório' });
  } else if (!isUuid(body.cliente_id)) {
    errs.push({ field: 'cliente_id', rule: 'uuid', message: 'cliente_id deve ser um UUID válido' });
  }
  if (body.config_id !== undefined && body.config_id !== null && !isUuid(body.config_id)) {
    errs.push({ field: 'config_id', rule: 'uuid', message: 'config_id deve ser um UUID válido (ou ausente)' });
  }
  if (body.allowed_doctor_ids !== undefined && !isStringArray(body.allowed_doctor_ids)) {
    errs.push({ field: 'allowed_doctor_ids', rule: 'string_array', message: 'allowed_doctor_ids deve ser array de strings' });
  } else if (Array.isArray(body.allowed_doctor_ids)) {
    body.allowed_doctor_ids.forEach((id: unknown, i: number) => {
      if (!isUuid(id as any)) {
        errs.push({ field: `allowed_doctor_ids[${i}]`, rule: 'uuid', message: 'cada allowed_doctor_id deve ser UUID' });
      }
    });
  }
  return errs;
}

/**
 * Validações específicas pra /availability.
 */
export function validateAvailabilityRequest(body: any): FieldError[] {
  const errs = validateBaseRequest(body);
  if (body && typeof body === 'object') {
    if (body.data_consulta !== undefined && body.data_consulta !== null && body.data_consulta !== '' && !isIsoOrBrDate(body.data_consulta)) {
      errs.push({ field: 'data_consulta', rule: 'date_format', message: 'data_consulta deve ser YYYY-MM-DD ou DD/MM/YYYY' });
    }
    if (body.periodo !== undefined && !['manha', 'manhã', 'tarde'].includes(String(body.periodo).toLowerCase())) {
      errs.push({ field: 'periodo', rule: 'enum', message: 'periodo deve ser "manha" ou "tarde"' });
    }
    if (body.quantidade_dias !== undefined && (typeof body.quantidade_dias !== 'number' || body.quantidade_dias < 1 || body.quantidade_dias > 200)) {
      errs.push({ field: 'quantidade_dias', rule: 'range', message: 'quantidade_dias deve ser número entre 1 e 200' });
    }
    if (body.buscar_proximas !== undefined && typeof body.buscar_proximas !== 'boolean') {
      errs.push({ field: 'buscar_proximas', rule: 'boolean', message: 'buscar_proximas deve ser boolean' });
    }
  }
  return errs;
}

/**
 * Validações específicas pra /schedule.
 */
export function validateScheduleRequest(body: any): FieldError[] {
  const errs = validateBaseRequest(body);
  if (body && typeof body === 'object') {
    if (!isNonEmptyString(body.paciente_nome)) {
      errs.push({ field: 'paciente_nome', rule: 'required', message: 'paciente_nome é obrigatório' });
    }
    if (!isNonEmptyString(body.celular)) {
      errs.push({ field: 'celular', rule: 'required', message: 'celular é obrigatório' });
    }
    if (body.data_consulta && !isIsoOrBrDate(body.data_consulta)) {
      errs.push({ field: 'data_consulta', rule: 'date_format', message: 'data_consulta deve ser YYYY-MM-DD ou DD/MM/YYYY' });
    }
    if (body.data_nascimento && !isIsoOrBrDate(body.data_nascimento)) {
      errs.push({ field: 'data_nascimento', rule: 'date_format', message: 'data_nascimento deve ser YYYY-MM-DD ou DD/MM/YYYY' });
    }
    if (body.hora_consulta && !isHora(body.hora_consulta) && !['manha', 'tarde', 'manhã'].includes(String(body.hora_consulta).toLowerCase())) {
      errs.push({ field: 'hora_consulta', rule: 'hora_or_periodo', message: 'hora_consulta deve ser HH:MM ou "manha"/"tarde"' });
    }
  }
  return errs;
}

/**
 * Validações específicas pra /reschedule, /cancel, /confirm.
 */
export function validateAgendamentoIdRequest(body: any): FieldError[] {
  const errs = validateBaseRequest(body);
  if (body && typeof body === 'object') {
    if (!isUuid(body.agendamento_id)) {
      errs.push({ field: 'agendamento_id', rule: 'uuid', message: 'agendamento_id é obrigatório (UUID)' });
    }
  }
  return errs;
}

// [M1] Caps de tamanho aplicados em endpoints com texto livre — previne
// payload de DoS (n8n bug enviando 5MB) e cap de tokens OpenAI ($$$).
const MAX_MENSAGEM_LEN = 4000;     // ~1k tokens GPT, suficiente pra qualquer pergunta real
const MAX_OBSERVACOES_LEN = 2000;
const MAX_HISTORICO_ITEMS = 50;
const MAX_HISTORICO_ITEM_LEN = 2000;

/**
 * /chat — handler conversacional. Limites de tamanho cruciais por causa
 * do custo OpenAI: cada token cobrado, prompt 50k explode a conta.
 */
export function validateChatRequest(body: any): FieldError[] {
  const errs = validateBaseRequest(body);
  if (body && typeof body === 'object') {
    if (typeof body.mensagem === 'string' && body.mensagem.length > MAX_MENSAGEM_LEN) {
      errs.push({
        field: 'mensagem',
        rule: 'max_length',
        message: `mensagem excede ${MAX_MENSAGEM_LEN} chars (atual: ${body.mensagem.length})`,
      });
    }
    if (body.historico !== undefined) {
      if (!Array.isArray(body.historico)) {
        errs.push({ field: 'historico', rule: 'array', message: 'historico deve ser array' });
      } else {
        if (body.historico.length > MAX_HISTORICO_ITEMS) {
          errs.push({
            field: 'historico',
            rule: 'max_items',
            message: `historico excede ${MAX_HISTORICO_ITEMS} itens (atual: ${body.historico.length})`,
          });
        }
        body.historico.forEach((m: any, i: number) => {
          if (typeof m === 'string' && m.length > MAX_HISTORICO_ITEM_LEN) {
            errs.push({
              field: `historico[${i}]`,
              rule: 'max_length',
              message: `item de histórico excede ${MAX_HISTORICO_ITEM_LEN} chars`,
            });
          }
          if (m && typeof m === 'object' && typeof m.content === 'string' && m.content.length > MAX_HISTORICO_ITEM_LEN) {
            errs.push({
              field: `historico[${i}].content`,
              rule: 'max_length',
              message: `content de histórico excede ${MAX_HISTORICO_ITEM_LEN} chars`,
            });
          }
        });
      }
    }
  }
  return errs;
}

/** Endpoints da fila — cap nas observações. */
export function validateFilaRequest(body: any): FieldError[] {
  const errs = validateBaseRequest(body);
  if (body && typeof body === 'object') {
    if (typeof body.observacoes === 'string' && body.observacoes.length > MAX_OBSERVACOES_LEN) {
      errs.push({
        field: 'observacoes',
        rule: 'max_length',
        message: `observacoes excede ${MAX_OBSERVACOES_LEN} chars`,
      });
    }
    if (body.paciente_nome !== undefined && typeof body.paciente_nome !== 'string') {
      errs.push({ field: 'paciente_nome', rule: 'string', message: 'paciente_nome deve ser string' });
    }
    if (body.celular !== undefined && typeof body.celular !== 'string') {
      errs.push({ field: 'celular', rule: 'string', message: 'celular deve ser string' });
    }
  }
  return errs;
}

/**
 * /patient-search — todos os campos opcionais mas tipos devem bater.
 */
export function validatePatientSearchRequest(body: any): FieldError[] {
  const errs = validateBaseRequest(body);
  if (body && typeof body === 'object') {
    for (const f of ['paciente_nome', 'nome', 'celular']) {
      if (body[f] !== undefined && typeof body[f] !== 'string') {
        errs.push({ field: f, rule: 'string', message: `${f} deve ser string` });
      }
    }
    if (body.data_nascimento && !isIsoOrBrDate(body.data_nascimento)) {
      errs.push({ field: 'data_nascimento', rule: 'date_format', message: 'data_nascimento inválida' });
    }
  }
  return errs;
}

/**
 * Builder de Response 400 estruturada.
 */
export function buildSchemaErrorResponse(errors: FieldError[], corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      success:     false,
      error:       'Validação de schema falhou',
      codigo_erro: 'SCHEMA_INVALIDO',
      detalhes:    errors,
    }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
