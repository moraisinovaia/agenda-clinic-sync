// ============= UTILITÁRIOS DE BLOQUEIOS DE AGENDA =============
//
// Encapsula a leitura da tabela `bloqueios_agenda` e fornece um Set<YYYY-MM-DD>
// para lookup O(1) durante a iteração de datas em availability.
//
// Multi-tenant: filtra sempre por cliente_id + medico_id + status='ativo'.
// O range é fechado em ambos os lados (inclusivo).

/**
 * Carrega TODAS as datas bloqueadas para um médico/cliente dentro do range.
 * Retorna Set<YYYY-MM-DD> com cada dia bloqueado já expandido (bloqueio de
 * 22/12 a 02/01 vira 12 entradas individuais), permitindo lookup O(1).
 *
 * Why: chamar isDataBloqueada(...) por dia faria N queries num loop. Esta
 * função faz 1 query e devolve um Set para uso eficiente no loop.
 */
export async function carregarDatasBloqueadas(
  supabase: any,
  clienteId: string,
  medicoId: string,
  dataInicio: string,   // YYYY-MM-DD
  dataFim: string,      // YYYY-MM-DD
): Promise<Set<string>> {
  const blocked = new Set<string>();

  if (!medicoId) return blocked;

  const { data, error } = await supabase
    .from('bloqueios_agenda')
    .select('data_inicio, data_fim, motivo')
    .eq('cliente_id', clienteId)
    .eq('medico_id', medicoId)
    .eq('status', 'ativo')
    // bloqueio se sobrepõe ao range pedido: começa antes do fim E termina depois do início
    .lte('data_inicio', dataFim)
    .gte('data_fim', dataInicio);

  if (error) {
    console.warn(`⚠️ [BLOQUEIOS] Erro ao carregar bloqueios para medico=${medicoId}: ${error.message}`);
    return blocked;
  }
  if (!data || data.length === 0) return blocked;

  for (const b of data) {
    if (!b?.data_inicio || !b?.data_fim) continue;
    const cur = new Date((b.data_inicio as string) + 'T00:00:00');
    const end = new Date((b.data_fim    as string) + 'T00:00:00');
    while (cur <= end) {
      blocked.add(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }
  }

  if (blocked.size > 0) {
    console.log(`🔒 [BLOQUEIOS] ${blocked.size} dia(s) bloqueado(s) para medico=${medicoId} entre ${dataInicio} e ${dataFim}`);
  }
  return blocked;
}

/** Verifica uma data isolada — útil quando o caller só precisa checar 1 dia. */
export async function isDataBloqueada(
  supabase: any,
  clienteId: string,
  medicoId: string,
  data: string,
): Promise<boolean> {
  const set = await carregarDatasBloqueadas(supabase, clienteId, medicoId, data, data);
  return set.has(data);
}
