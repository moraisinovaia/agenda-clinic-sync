// ============= REQUEST BUDGET (deadline propagation) =============
//
// Edge Functions têm limite de ~30s. Em chat.ts, uma request pode encadear:
//   - load config
//   - chamar OpenAI (até 25s + 25s retry = 50s pior caso)
//   - chamar handler interno (availability/schedule, alguns segundos)
// Total pior caso pode estourar 60s, retornando 504 ao caller que então
// retenta — pior do que falhar rápido.
//
// Este budget é um "deadline" propagado por chamada. Operações longas (OpenAI,
// queries pesadas) consultam `remaining()` antes de gastar tempo. Quando
// vencido → fail-fast com erro retryable.

const TOTAL_BUDGET_MS_DEFAULT = 28_000; // 2s margem do limite ~30s da Edge Function

export interface RequestBudget {
  /** Tempo total disponível pra request (em ms desde start) */
  totalMs:    number;
  startedAt:  number; // performance.now()
  remaining:  () => number;
  /** Lança DeadlineError se já estourou */
  ensureNotExpired: () => void;
}

export class DeadlineError extends Error {
  constructor(remaining: number) {
    super(`Request budget esgotado (${remaining}ms restantes)`);
    this.name = 'DeadlineError';
  }
}

const TOTAL_BUDGET_MS = (() => {
  const raw = Deno.env.get('REQUEST_BUDGET_MS');
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : TOTAL_BUDGET_MS_DEFAULT;
})();

export function createBudget(totalMs?: number): RequestBudget {
  const total = totalMs ?? TOTAL_BUDGET_MS;
  const startedAt = performance.now();
  return {
    totalMs:    total,
    startedAt,
    remaining:  () => total - (performance.now() - startedAt),
    ensureNotExpired() {
      const r = total - (performance.now() - startedAt);
      if (r <= 0) throw new DeadlineError(r);
    },
  };
}
