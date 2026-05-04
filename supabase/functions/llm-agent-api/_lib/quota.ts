// ============= QUOTA DIÁRIA POR TENANT =============
//
// Cap atômico de chamadas OpenAI/total por tenant via Postgres counter
// (RPC `increment_tenant_quota`). Reset diário UTC.
//
// Uso: chamar checkAndIncrementQuota() ANTES de chamar OpenAI/handler caro.
// Se retornar `allowed: false`, rejeitar a request com 429.
//
// Por que Postgres e não in-memory?
//   - In-memory zera no cold-start → atacante (ou bug n8n) pode espalhar
//     calls em rajadas que cada nova instance aceita.
//   - Postgres é fonte de verdade compartilhada entre todas instances.
//
// Defaults configuráveis via env:
//   QUOTA_OPENAI_PER_DAY    (default: 5000 — cobre clínica ~3000 msg/dia)
//   QUOTA_TOTAL_PER_DAY     (default: 50000 — req/dia agregado)

const QUOTA_OPENAI_PER_DAY = (() => {
  const raw = Deno.env.get('QUOTA_OPENAI_PER_DAY');
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 5000;
})();

const QUOTA_TOTAL_PER_DAY = (() => {
  const raw = Deno.env.get('QUOTA_TOTAL_PER_DAY');
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 50000;
})();

export interface QuotaCheckResult {
  allowed:       boolean;
  reason?:       'openai_quota' | 'total_quota';
  openai_calls?: number;
  total_calls?:  number;
  limits?:       { openai: number; total: number };
}

/**
 * Incrementa atomicamente o contador do tenant e verifica se ainda está
 * dentro do cap. Se exceder, retorna `allowed: false` com o tipo de quota.
 *
 * Importante: o increment acontece SEMPRE — mesmo quando `allowed=false`.
 * Isso é intencional: se um atacante tenta abusar, queremos contar TODAS
 * as tentativas (não dar oportunidade de re-tentar com bypass).
 */
export async function checkAndIncrementQuota(
  supabase: any,
  clienteId: string,
  kind: 'openai' | 'total' = 'total',
): Promise<QuotaCheckResult> {
  const { data, error } = await supabase.rpc('increment_tenant_quota', {
    p_cliente_id: clienteId,
    p_kind:       kind,
  });

  if (error) {
    // Fail-open: se a quota check falhar, NÃO bloqueia — operação continua.
    // Alternativa fail-closed seria mais segura mas atrapalha quando RPC tem bug.
    console.warn(`[quota] erro ao incrementar quota: ${error.message} (fail-open)`);
    return { allowed: true };
  }

  const openai_calls = data?.openai_calls ?? 0;
  const total_calls  = data?.total_calls ?? 0;

  if (kind === 'openai' && openai_calls > QUOTA_OPENAI_PER_DAY) {
    console.warn(`[quota] cliente_id=${clienteId} excedeu quota OpenAI: ${openai_calls}/${QUOTA_OPENAI_PER_DAY}`);
    return {
      allowed:      false,
      reason:       'openai_quota',
      openai_calls,
      total_calls,
      limits:       { openai: QUOTA_OPENAI_PER_DAY, total: QUOTA_TOTAL_PER_DAY },
    };
  }
  if (total_calls > QUOTA_TOTAL_PER_DAY) {
    console.warn(`[quota] cliente_id=${clienteId} excedeu quota total: ${total_calls}/${QUOTA_TOTAL_PER_DAY}`);
    return {
      allowed:      false,
      reason:       'total_quota',
      openai_calls,
      total_calls,
      limits:       { openai: QUOTA_OPENAI_PER_DAY, total: QUOTA_TOTAL_PER_DAY },
    };
  }

  return { allowed: true, openai_calls, total_calls };
}
