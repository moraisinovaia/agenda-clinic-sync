// OpenAI Chat Completions caller for Supabase Edge Functions (Deno).
// Uses fetch() directly — no npm dependency.

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Tempo máximo por tentativa antes de abortar a chamada à OpenAI.
// 25 s deixa margem confortável dentro do limite de 30 s da Edge Function
// e ainda permite uma 2ª tentativa caso a primeira sofra timeout.
export const REQUEST_TIMEOUT_MS = 25000;

// Status retentáveis: rate-limit, request-timeout do servidor e 5xx transitórios.
// 400/401/403/404 não são retentados — repetir não muda o resultado.
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

// ── [F2.1] Circuit breaker ──────────────────────────────────────────────
//
// Quando OpenAI cai, cada request paga até 50s (25s × 2) antes do fallback.
// Em rajada, isso esgota concorrência da Edge Function → fila de timeouts e
// custo OpenAI explode (cada timed-out request foi cobrada).
//
// O breaker tem 3 estados:
//   - CLOSED: tudo normal, requests passam
//   - OPEN:   após N falhas consecutivas, abre por T ms; novas requests
//             pulam direto pra OpenAIUnavailableError (sem chamar API)
//   - HALF_OPEN: passado o cooldown, deixa 1 request testar; se OK → CLOSED,
//             se falha → volta a OPEN
//
// Override por env: BREAKER_FAILURES (default 5) e BREAKER_COOLDOWN_MS (default 30000)
const BREAKER_FAILURES = (() => {
  const raw = Deno.env.get('BREAKER_FAILURES');
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 5;
})();
const BREAKER_COOLDOWN_MS = (() => {
  const raw = Deno.env.get('BREAKER_COOLDOWN_MS');
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 30_000;
})();

type BreakerState = 'closed' | 'open' | 'half_open';

interface Breaker {
  state:        BreakerState;
  failures:     number;
  openedAt:     number;
  lastTrialAt:  number;
}

// [H2] Per-tenant breaker. Antes era singleton: 1 cliente quebrando OpenAI
// (ex.: prompt mal configurado retornando 401 repetido) abria o breaker pra
// TODOS os tenants — fallback humano em todos por 30s.
//
// Agora cada `clienteId` tem seu bucket isolado. Falha do cliente A não
// afeta latência do cliente B.
//
// Caller passa `tenantKey` (cliente_id ou 'global' quando ausente). Cold-start
// zera todos. Pra escala real (Redis), seria a mesma estrutura externalizada.
const breakers = new Map<string, Breaker>();

function getBreaker(tenantKey: string): Breaker {
  let b = breakers.get(tenantKey);
  if (!b) {
    b = { state: 'closed', failures: 0, openedAt: 0, lastTrialAt: 0 };
    breakers.set(tenantKey, b);
  }
  return b;
}

function breakerCheck(tenantKey: string): { proceed: boolean; reason?: string } {
  const b = getBreaker(tenantKey);
  const now = Date.now();
  if (b.state === 'open') {
    if (now - b.openedAt >= BREAKER_COOLDOWN_MS) {
      b.state = 'half_open';
      b.lastTrialAt = 0;
      console.log(`[BREAKER:${tenantKey}] cooldown expirado → half_open`);
    } else {
      return {
        proceed: false,
        reason:  `circuit_open (cooldown ${Math.ceil((BREAKER_COOLDOWN_MS - (now - b.openedAt)) / 1000)}s)`,
      };
    }
  }
  if (b.state === 'half_open') {
    if (b.lastTrialAt > 0 && now - b.lastTrialAt < REQUEST_TIMEOUT_MS) {
      return { proceed: false, reason: 'circuit_half_open_trial_in_progress' };
    }
    b.lastTrialAt = now;
  }
  return { proceed: true };
}

function breakerOnSuccess(tenantKey: string): void {
  const b = getBreaker(tenantKey);
  if (b.state !== 'closed') {
    console.log(`[BREAKER:${tenantKey}] sucesso → closed (era ${b.state})`);
  }
  b.state = 'closed';
  b.failures = 0;
  b.openedAt = 0;
  b.lastTrialAt = 0;
}

function breakerOnFailure(tenantKey: string): void {
  const b = getBreaker(tenantKey);
  b.failures += 1;
  if (b.state === 'half_open') {
    b.state = 'open';
    b.openedAt = Date.now();
    b.lastTrialAt = 0;
    console.warn(`[BREAKER:${tenantKey}] half_open trial falhou → open por ${BREAKER_COOLDOWN_MS}ms`);
    return;
  }
  if (b.state === 'closed' && b.failures >= BREAKER_FAILURES) {
    b.state = 'open';
    b.openedAt = Date.now();
    console.warn(`[BREAKER:${tenantKey}] ${b.failures} falhas consecutivas → open por ${BREAKER_COOLDOWN_MS}ms`);
  }
}

/** Retorna o estado atual do breaker do tenant. Uso em /metrics. */
export function getBreakerState(tenantKey = 'global'): { state: BreakerState; failures: number; openedAt: number } {
  const b = breakers.get(tenantKey);
  return b ? { state: b.state, failures: b.failures, openedAt: b.openedAt } : { state: 'closed', failures: 0, openedAt: 0 };
}

// Mensagem mostrada ao paciente quando a OpenAI fica indisponível mesmo após o retry.
// Mantida em pt-BR e neutra: não cita OpenAI/sistema/falha técnica.
export const OPENAI_FALLBACK_MESSAGE =
  'Estou com instabilidade no momento e vou transferir o seu atendimento para um atendente humano. ' +
  'Por favor, aguarde um instante. 🙏';

/**
 * Erro lançado quando a OpenAI fica indisponível após o retry, ou quando a
 * configuração impede a chamada (ex.: OPENAI_API_KEY ausente).
 *
 * Why: o catch externo de handleChat usa `err.name === 'OpenAIUnavailableError'`
 * para decidir entre fallback humanizado vs. erro técnico genérico.
 */
export class OpenAIUnavailableError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'OpenAIUnavailableError';
  }
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  messages: OpenAIMessage[];
  jsonSchemaName: string;
  jsonSchema: Record<string, unknown>;
  /** [H2] Identificador do tenant pro circuit breaker isolar falhas por cliente. */
  tenantKey?: string;
}

export interface ChatCompletionResult {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

async function fetchOnce(payload: unknown, apiKey: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function isTransientNetworkError(err: any): boolean {
  // AbortError (timeout) e TypeError (DNS/conexão) são considerados transitórios.
  return err?.name === 'AbortError' || err instanceof TypeError;
}

export async function chatCompletion(
  req: ChatCompletionRequest,
): Promise<ChatCompletionResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new OpenAIUnavailableError('OPENAI_API_KEY não configurado');
  }

  // [F2.1 + H2] Circuit breaker per-tenant: falha em cliente A não derruba B
  const tenantKey = req.tenantKey || 'global';
  const check = breakerCheck(tenantKey);
  if (!check.proceed) {
    console.warn(`[OPENAI:${tenantKey}] breaker bloqueou: ${check.reason}`);
    throw new OpenAIUnavailableError(`OpenAI temporariamente indisponível (${check.reason})`);
  }

  const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';

  const payload = {
    model,
    messages: req.messages,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: req.jsonSchemaName,
        strict: false,   // flex para dados_coletados e dados_para_handler dinâmicos
        schema: req.jsonSchema,
      },
    },
  };

  // 1ª tentativa + no máximo 1 retry (apenas para falhas transitórias).
  let response: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      response = await fetchOnce(payload, apiKey);

      if (response.ok) break;

      if (RETRYABLE_STATUS.has(response.status) && attempt === 1) {
        console.warn(`[OPENAI] Status ${response.status} na tentativa ${attempt}; retentando 1x...`);
        continue;
      }

      // Status não-retentável (ex.: 401) ou retry esgotado: lê corpo e desiste.
      const errText = await response.text();
      breakerOnFailure(tenantKey);
      throw new OpenAIUnavailableError(
        `OpenAI ${response.status}: ${errText.slice(0, 200)}`,
      );
    } catch (err: any) {
      // Se já é OpenAIUnavailableError vindo do branch acima, re-lança direto.
      if (err instanceof OpenAIUnavailableError) throw err;

      lastError = err;
      if (isTransientNetworkError(err) && attempt === 1) {
        console.warn(`[OPENAI] Erro transitório (${err?.name ?? 'unknown'}) na tentativa ${attempt}; retentando 1x...`);
        continue;
      }

      breakerOnFailure(tenantKey);
      throw new OpenAIUnavailableError(
        `Falha ao chamar OpenAI: ${err?.message ?? String(err)}`,
        err,
      );
    }
  }

  if (!response || !response.ok) {
    breakerOnFailure(tenantKey);
    throw new OpenAIUnavailableError(
      `OpenAI indisponível após retry: ${(lastError as any)?.message ?? 'sem detalhes'}`,
      lastError,
    );
  }

  const data = await response.json();

  const content: string = data.choices?.[0]?.message?.content ?? '';
  if (!content) {
    breakerOnFailure(tenantKey);
    throw new OpenAIUnavailableError('OpenAI retornou conteúdo vazio');
  }

  breakerOnSuccess(tenantKey);
  return {
    content,
    usage: data.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}
