// ============= CACHE in-memory por tenant — medicos + atendimentos =============
//
// Tabelas que mudam raramente (semanal/mensal): médicos, atendimentos.
// Cada `/availability`, `/schedule`, `/chat` faz fresh SELECT delas — em
// 7 clínicas × 200 msg/dia × 1.5 calls = ~2k SELECTs/dia que poderiam ser
// servidos do cache.
//
// Estratégia:
//   - TTL 5 minutos (mudança no painel admin propaga em até 5min)
//   - Keyed por cliente_id (multi-tenant safe)
//   - Reset por cold-start (Edge Function instances)
//   - Cross-instance: mudança via /admin/invalidate-tenant-cache (futuro)
//
// Limitação: in-memory, mesmo padrão do CONFIG_CACHE. Pra escala 100+ tenants
// migrar pra Redis com SUBSCRIBE/PUBLISH.

const TTL_MS = 5 * 60 * 1000;

interface MedicoCached {
  id: string;
  nome: string;
  ativo: boolean;
  crm?: string;
  rqe?: string;
  is_agenda_virtual?: boolean;
  convenios_aceitos?: string[];
  idade_minima?: number;
  idade_maxima?: number;
}

interface AtendimentoCached {
  id: string;
  nome: string;
  tipo?: string;
  ativo: boolean;
  medico_id?: string;
}

interface TenantCacheEntry {
  medicos:        MedicoCached[];
  atendimentos:   AtendimentoCached[];
  loadedAt:       number;
}

const TENANT_CACHE = new Map<string, TenantCacheEntry>();

function isFresh(entry: TenantCacheEntry | undefined): entry is TenantCacheEntry {
  return !!entry && Date.now() - entry.loadedAt < TTL_MS;
}

/**
 * Carrega medicos + atendimentos do tenant. Hit no cache se TTL ainda válido,
 * else fresh load do banco (1 round-trip pra cada tabela).
 *
 * Quem chama: handlers que precisam validar/listar — availability, schedule,
 * fila-espera, list-doctors, etc. Substitui SELECT inline.
 */
export async function getTenantMedicos(supabase: any, clienteId: string): Promise<MedicoCached[]> {
  const cached = TENANT_CACHE.get(clienteId);
  if (isFresh(cached)) return cached.medicos;

  const { data, error } = await supabase
    .from('medicos')
    .select('id, nome, ativo, crm, rqe, is_agenda_virtual, convenios_aceitos, idade_minima, idade_maxima')
    .eq('cliente_id', clienteId)
    .eq('ativo', true);

  if (error) {
    console.warn(`[tenant-cache] erro ao carregar medicos do cliente ${clienteId}: ${error.message}`);
    return (cached as TenantCacheEntry | undefined)?.medicos ?? [];  // fallback pro cached antigo se houver
  }

  const medicos = (data ?? []) as MedicoCached[];
  // Atualizar entry preservando atendimentos se já carregados
  TENANT_CACHE.set(clienteId, {
    medicos,
    atendimentos: (cached as TenantCacheEntry | undefined)?.atendimentos ?? [],
    loadedAt:     Date.now(),
  });
  return medicos;
}

export async function getTenantAtendimentos(supabase: any, clienteId: string): Promise<AtendimentoCached[]> {
  const cached = TENANT_CACHE.get(clienteId);
  if (isFresh(cached) && cached.atendimentos.length > 0) return cached.atendimentos;

  const { data, error } = await supabase
    .from('atendimentos')
    .select('id, nome, tipo, ativo, medico_id')
    .eq('cliente_id', clienteId)
    .eq('ativo', true);

  if (error) {
    console.warn(`[tenant-cache] erro ao carregar atendimentos do cliente ${clienteId}: ${error.message}`);
    return cached?.atendimentos ?? [];
  }

  const atendimentos = (data ?? []) as AtendimentoCached[];
  TENANT_CACHE.set(clienteId, {
    medicos:      cached?.medicos ?? [],
    atendimentos,
    loadedAt:     Date.now(),
  });
  return atendimentos;
}

/**
 * Invalida cache do tenant. Chamado por endpoint admin quando médico/atendimento
 * é alterado e a clínica não quer esperar 5min.
 */
export function invalidateTenantCache(clienteId: string): boolean {
  return TENANT_CACHE.delete(clienteId);
}

/** Snapshot pra /metrics. */
export function getTenantCacheStats(): { tenants: number; total_size_estimate_kb: number } {
  let bytes = 0;
  for (const e of TENANT_CACHE.values()) {
    bytes += JSON.stringify(e).length;
  }
  return { tenants: TENANT_CACHE.size, total_size_estimate_kb: Math.round(bytes / 1024) };
}
