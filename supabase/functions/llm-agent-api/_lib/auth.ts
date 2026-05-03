// ============= AUTENTICAÇÃO MULTI-TENANT =============
//
// Resolve `cliente_id` a partir do header `x-api-key`. Cada tenant tem sua
// própria key, hashada (SHA-256) e armazenada em `api_keys`. O middleware
// rejeita se `body.cliente_id` divergir do tenant da key — bloqueia o
// vetor de ataque "tenant A tem a key e chama com cliente_id de B".
//
// Backwards compat (modo legacy):
//   - Se a key bate com env `N8N_API_KEY`, aceita SEM bind de tenant.
//   - Logs `level: warn` chamam atenção pra finalizar a migração.
//   - Plano: rotacionar todos os tenants pra api_keys, depois remover o
//     fallback (env var continua existindo só pra admin endpoints).

const encoder = new TextEncoder();

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export type AuthMode = 'tenant_key' | 'legacy_global';

export interface AuthResolution {
  ok:        true;
  mode:      AuthMode;
  /** cliente_id vinculado à key (ou null se modo legacy global) */
  clienteId: string | null;
  /** id da entry api_keys (apenas em mode='tenant_key') */
  apiKeyId?: string;
}

export interface AuthRejection {
  ok:     false;
  reason: 'missing' | 'invalid' | 'cliente_mismatch' | 'revoked';
  status: number;
  message: string;
}

/**
 * Valida a key recebida e resolve cliente_id quando possível.
 * NÃO compara contra body.cliente_id ainda — o caller faz isso depois.
 */
export async function resolveAuth(
  supabase: any,
  rawKey: string | null,
): Promise<AuthResolution | AuthRejection> {
  if (!rawKey || rawKey.length === 0) {
    return {
      ok:      false,
      reason:  'missing',
      status:  401,
      message: 'Unauthorized — Invalid or missing API Key',
    };
  }

  // 1) Tenta resolver via tabela `api_keys` (path moderno)
  try {
    const hash = await sha256Hex(rawKey);
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, cliente_id, ativo, revoked_at')
      .eq('key_hash', hash)
      .eq('ativo', true)
      .is('revoked_at', null)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      // Atualiza last_used_at fire-and-forget (sem await pra não atrasar)
      supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', data.id)
        .then(() => {}, () => {});

      return {
        ok:        true,
        mode:      'tenant_key',
        clienteId: data.cliente_id,
        apiKeyId:  data.id,
      };
    }
  } catch (e) {
    console.warn('[auth] erro ao consultar api_keys, caindo pra legacy:', (e as Error).message);
  }

  // 2) Fallback legacy — env N8N_API_KEY (sem bind de tenant)
  const legacyKey = Deno.env.get('N8N_API_KEY');
  if (legacyKey && rawKey === legacyKey) {
    return {
      ok:        true,
      mode:      'legacy_global',
      clienteId: null,
    };
  }

  return {
    ok:      false,
    reason:  'invalid',
    status:  401,
    message: 'Unauthorized — Invalid or missing API Key',
  };
}

/**
 * Aplicar regra de "cliente_id da key === body.cliente_id" quando estamos
 * em mode='tenant_key'. Em mode='legacy_global', body.cliente_id é fonte
 * de verdade (comportamento antigo, vai sumir após rotação de keys).
 */
export function enforceTenantBinding(
  auth: AuthResolution,
  bodyClienteId: string | undefined,
): AuthRejection | null {
  if (auth.mode === 'legacy_global') return null; // legado: trust no body

  if (auth.clienteId && bodyClienteId && auth.clienteId !== bodyClienteId) {
    return {
      ok:      false,
      reason:  'cliente_mismatch',
      status:  403,
      message: `API key não autorizada para cliente_id=${bodyClienteId}`,
    };
  }
  return null;
}
