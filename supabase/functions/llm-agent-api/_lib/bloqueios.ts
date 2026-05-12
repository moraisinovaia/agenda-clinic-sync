// ============= UTILITÁRIOS DE BLOQUEIOS DE AGENDA =============
//
// Encapsula a leitura da tabela `bloqueios_agenda`. Suporta:
//   - Bloqueio de DIA INTEIRO (hora_inicio e hora_fim NULL)
//   - Bloqueio PARCIAL por horário (ex: 07:00-12:00 = só manhã)
//
// A função antiga `carregarDatasBloqueadas` retorna apenas os dias 100%
// bloqueados (backward compat com chamadas que usam Set<string>.has).
// Para suporte ao bloqueio parcial, use `carregarBloqueiosDetalhados` que
// retorna Map<string, BlockInfo> e os helpers `isPeriodBlocked` /
// `isHoraBlocked` pra checar overlap com período/hora específica.
//
// Multi-tenant: filtra sempre por cliente_id + medico_id + status='ativo'.

export interface BlockTimeRange {
  inicio: string; // 'HH:MM:SS' ou 'HH:MM'
  fim:    string;
}

export interface BlockInfo {
  fullDay: boolean;                // true se algum bloqueio do dia for sem hora
  ranges:  BlockTimeRange[];       // bloqueios parciais (vazio se fullDay=true ou sem parciais)
}

// ── Helpers de comparação horária ─────────────────────────────────────────

/** Normaliza 'HH:MM' ou 'HH:MM:SS' para minutos desde 00:00. */
function timeToMin(t: string | null | undefined): number | null {
  if (!t || typeof t !== 'string') return null;
  const parts = t.split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/** Dois ranges [a..b] e [c..d] se sobrepõem se a < d AND c < b. */
export function timeRangesOverlap(
  startA: string, endA: string,
  startB: string, endB: string,
): boolean {
  const a = timeToMin(startA), b = timeToMin(endA);
  const c = timeToMin(startB), d = timeToMin(endB);
  if (a === null || b === null || c === null || d === null) return false;
  return a < d && c < b;
}

/** Verifica se uma hora pontual cai dentro de algum range. */
export function isHoraBlocked(
  map: Map<string, BlockInfo>,
  data: string,
  hora: string,
): boolean {
  const info = map.get(data);
  if (!info) return false;
  if (info.fullDay) return true;
  const m = timeToMin(hora);
  if (m === null) return false;
  return info.ranges.some((r) => {
    const i = timeToMin(r.inicio), f = timeToMin(r.fim);
    if (i === null || f === null) return false;
    return m >= i && m < f;
  });
}

/** Verifica se um período (start/end) está bloqueado total OU parcialmente. */
export function isPeriodBlocked(
  map: Map<string, BlockInfo>,
  data: string,
  periodStart: string,
  periodEnd: string,
): boolean {
  const info = map.get(data);
  if (!info) return false;
  if (info.fullDay) return true;
  return info.ranges.some((r) => timeRangesOverlap(periodStart, periodEnd, r.inicio, r.fim));
}

/** Dia totalmente bloqueado (sem possibilidade de atender qualquer período). */
export function isDataBlockedFully(map: Map<string, BlockInfo>, data: string): boolean {
  return map.get(data)?.fullDay === true;
}

// ── Carga de bloqueios ───────────────────────────────────────────────────

/**
 * NOVA FUNÇÃO — versão detalhada que preserva info de hora_inicio/hora_fim.
 *
 * Retorna Map<YYYY-MM-DD, BlockInfo>. Cada dia agrega:
 *  - fullDay = true se ALGUM bloqueio cobrir o dia inteiro (hora_inicio NULL)
 *  - ranges  = lista de bloqueios parciais (com hora) sobre aquele dia
 *
 * Use os helpers acima pra consultar.
 */
export async function carregarBloqueiosDetalhados(
  supabase: any,
  clienteId: string,
  medicoIds: string | string[],
  dataInicio: string,
  dataFim: string,
): Promise<Map<string, BlockInfo>> {
  const blocks = new Map<string, BlockInfo>();

  const ids = Array.isArray(medicoIds)
    ? Array.from(new Set(medicoIds.filter((x) => typeof x === 'string' && x.length > 0)))
    : (medicoIds ? [medicoIds] : []);

  if (ids.length === 0) return blocks;

  const { data, error } = await supabase
    .from('bloqueios_agenda')
    .select('data_inicio, data_fim, hora_inicio, hora_fim, motivo, medico_id')
    .eq('cliente_id', clienteId)
    .in('medico_id', ids)
    .eq('status', 'ativo')
    .lte('data_inicio', dataFim)
    .gte('data_fim', dataInicio);

  if (error) {
    console.warn(`⚠️ [BLOQUEIOS] Erro: ${error.message}`);
    return blocks;
  }
  if (!data || data.length === 0) return blocks;

  for (const b of data) {
    if (!b?.data_inicio || !b?.data_fim) continue;
    const isFullDay = !b.hora_inicio && !b.hora_fim;

    const cur = new Date((b.data_inicio as string) + 'T00:00:00');
    const end = new Date((b.data_fim    as string) + 'T00:00:00');

    while (cur <= end) {
      const key = cur.toISOString().split('T')[0];
      let info = blocks.get(key);
      if (!info) {
        info = { fullDay: false, ranges: [] };
        blocks.set(key, info);
      }
      if (isFullDay) {
        info.fullDay = true;
      } else {
        info.ranges.push({
          inicio: b.hora_inicio as string,
          fim:    b.hora_fim    as string,
        });
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  if (blocks.size > 0) {
    const fullCount = Array.from(blocks.values()).filter((v) => v.fullDay).length;
    const partialCount = blocks.size - fullCount;
    console.log(
      `🔒 [BLOQUEIOS] ${blocks.size} dia(s) com bloqueio entre ${dataInicio} e ${dataFim} ` +
      `(${fullCount} dia inteiro, ${partialCount} parcial)`,
    );
  }
  return blocks;
}

/**
 * COMPAT — função antiga. Agora retorna Set APENAS com dias 100% bloqueados
 * (sem hora_inicio/hora_fim). Dias parcialmente bloqueados NÃO entram aqui
 * — callers que precisam disso devem migrar pra carregarBloqueiosDetalhados.
 */
export async function carregarDatasBloqueadas(
  supabase: any,
  clienteId: string,
  medicoIds: string | string[],
  dataInicio: string,
  dataFim: string,
): Promise<Set<string>> {
  const blocked = new Set<string>();
  const map = await carregarBloqueiosDetalhados(supabase, clienteId, medicoIds, dataInicio, dataFim);
  for (const [data, info] of map.entries()) {
    if (info.fullDay) blocked.add(data);
  }
  return blocked;
}

/** Verifica uma data isolada — útil quando o caller só precisa checar 1 dia. */
export async function isDataBloqueada(
  supabase: any,
  clienteId: string,
  medicoIds: string | string[],
  data: string,
): Promise<boolean> {
  const set = await carregarDatasBloqueadas(supabase, clienteId, medicoIds, data, data);
  return set.has(data);
}
