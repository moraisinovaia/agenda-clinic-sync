// ============= RATE LIMITER POR cliente_id (in-memory + Postgres) =============
//
// Defesa em 2 camadas:
//   1. In-memory token bucket por instance (rápido, sem round-trip)
//   2. Postgres counter cross-instance via RPC `increment_rate_limit` (autoritativo)
//
// Por que ambos:
//   - In-memory pega 99% dos casos sem custo (zero round-trip)
//   - Postgres pega o caso patológico: atacante que dispara em rajadas
//     atravessando cold-starts. In-memory zera, Postgres não.
//
// Estratégia: in-memory passa? OK. Se chegar perto do cap, consulta Postgres.
//
// Configuração padrão (override via env):
//   RATE_LIMIT_PER_MIN — máx de requests/min por cliente (default: 60)
//   RATE_LIMIT_BURST   — burst inicial (default: 20)

const PER_MIN_DEFAULT = 60;
const BURST_DEFAULT   = 20;

const PER_MIN = (() => {
  const raw = Deno.env.get('RATE_LIMIT_PER_MIN');
  const n   = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : PER_MIN_DEFAULT;
})();
const BURST = (() => {
  const raw = Deno.env.get('RATE_LIMIT_BURST');
  const n   = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : BURST_DEFAULT;
})();

const REFILL_PER_MS = PER_MIN / 60_000; // tokens/ms

interface Bucket {
  tokens:    number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed:        boolean;
  retryAfterMs?:  number; // quando allowed=false
  remaining:      number;
}

/**
 * Tenta consumir 1 token do bucket do tenant. Retorna se a request pode
 * passar. Quando excede, retorna `retryAfterMs` (sugestão de Retry-After).
 */
export function checkRateLimit(clienteId: string): RateLimitResult {
  if (!clienteId) {
    return { allowed: true, remaining: BURST }; // sem tenant → não rate-limit
  }

  const now = Date.now();
  let b = buckets.get(clienteId);
  if (!b) {
    b = { tokens: BURST, lastRefill: now };
    buckets.set(clienteId, b);
  }

  // Refill: tokens acumulados desde o último refill
  const elapsed = now - b.lastRefill;
  if (elapsed > 0) {
    b.tokens = Math.min(BURST, b.tokens + elapsed * REFILL_PER_MS);
    b.lastRefill = now;
  }

  if (b.tokens >= 1) {
    b.tokens -= 1;
    return { allowed: true, remaining: Math.floor(b.tokens) };
  }

  // Falta < 1 token. Quanto tempo até ter 1 token?
  const deficit = 1 - b.tokens;
  const retryAfterMs = Math.ceil(deficit / REFILL_PER_MS);
  return { allowed: false, retryAfterMs, remaining: 0 };
}

/** Útil pra /metrics: quantos buckets ativos? */
export function rateLimitStats(): { tenants: number; per_min: number; burst: number } {
  return { tenants: buckets.size, per_min: PER_MIN, burst: BURST };
}

/**
 * [H3] Rate limit autoritativo via Postgres. Usar quando in-memory não dá
 * confiança (cold-start ou multi-instance). Faz 1 round-trip Postgres mas
 * é a única forma de conter atacante que distribui calls.
 *
 * Política: chama esta função SOMENTE em caminhos caros (/chat com OpenAI).
 * Pra /availability/list-doctors o in-memory já é suficiente.
 */
export async function checkRateLimitPersistent(
  supabase: any,
  clienteId: string,
): Promise<RateLimitResult> {
  if (!clienteId) return { allowed: true, remaining: PER_MIN };

  try {
    const { data, error } = await supabase.rpc('increment_rate_limit', {
      p_cliente_id:     clienteId,
      p_window_seconds: 60,
    });
    if (error) {
      // Fail-open quando RPC quebra — não derrubar API por isso
      console.warn(`[rate-limit-persistent] erro: ${error.message} (fail-open)`);
      return { allowed: true, remaining: PER_MIN };
    }
    const windowCount: number = data?.count_window ?? 0;
    if (windowCount > PER_MIN) {
      return {
        allowed:      false,
        retryAfterMs: 60_000,  // próximo minuto
        remaining:    0,
      };
    }
    return { allowed: true, remaining: Math.max(0, PER_MIN - windowCount) };
  } catch (e: any) {
    console.warn(`[rate-limit-persistent] exception: ${e.message} (fail-open)`);
    return { allowed: true, remaining: PER_MIN };
  }
}
