// =============== ADMIN HANDLERS ===============
//
// Endpoints administrativos pra operação multi-tenant em produção:
//   - validate-config: valida o JSONB de business_rules.config de uma clínica
//
// Diferentemente dos handlers de produto (schedule/availability/etc), estes
// endpoints retornam relatórios estruturados pra ferramentas internas (painel
// admin, CI, runbook de onboarding) — não pra LLM/paciente.
//
// Quando onboardar uma clínica nova, rode este endpoint ANTES de habilitar
// o canal pra evitar bugs como o "MRPA dias_semana incompleto" do Dr. Marcelo.

import { validateBusinessRulesConfig } from '../_lib/validate-config.ts';
import { invalidateCache } from '../_lib/config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * POST /admin/validate-config
 *
 * Body:
 *   - cliente_id (uuid, obrigatório)
 *   - medico_id  (uuid, opcional — valida só essa entry; default: todas as
 *                 entries `ativo=true` desse cliente_id)
 *
 * Retorna por entry: id, medico_id, nome, summary {errors,warns,infos},
 * findings[]. Top-level: ok=true se TODAS as entries têm 0 errors.
 */
export async function handleValidateConfig(
  supabase: any,
  body: any,
  clienteId: string,
): Promise<Response> {
  const medicoId: string | undefined = typeof body?.medico_id === 'string' && body.medico_id.length > 0
    ? body.medico_id
    : undefined;

  let query = supabase
    .from('business_rules')
    .select('id, medico_id, ativo, config')
    .eq('cliente_id', clienteId)
    .eq('ativo', true);

  if (medicoId) {
    query = query.eq('medico_id', medicoId);
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error('[admin/validate-config] erro:', error);
    return jsonResponse({
      success: false,
      error: 'Erro ao carregar business_rules',
      details: error.message,
    }, 500);
  }

  if (!rows || rows.length === 0) {
    return jsonResponse({
      success: false,
      error: medicoId
        ? `Nenhuma config ativa encontrada para medico_id=${medicoId} no cliente ${clienteId}`
        : `Nenhuma config ativa encontrada para cliente_id=${clienteId}`,
      detalhes: { cliente_id: clienteId, medico_id: medicoId ?? null },
    }, 404);
  }

  // Carrega nomes dos médicos pra enriquecer o relatório
  const medicoIds = (rows as Array<{ medico_id: string }>).map((r) => r.medico_id);
  const { data: medicos } = await supabase
    .from('medicos')
    .select('id, nome')
    .eq('cliente_id', clienteId)
    .in('id', medicoIds);
  const nomePorId: Record<string, string> = {};
  for (const m of (medicos as Array<{ id: string; nome: string }>) ?? []) {
    nomePorId[m.id] = m.nome;
  }

  const reports = rows.map((r: any) => {
    const report = validateBusinessRulesConfig(r.config);
    return {
      business_rule_id: r.id,
      medico_id:        r.medico_id,
      medico_nome:      nomePorId[r.medico_id] ?? null,
      ok:               report.ok,
      summary:          report.summary,
      findings:         report.findings,
    };
  });

  const allOk = reports.every((r: any) => r.ok);
  const totals = reports.reduce(
    (acc: { errors: number; warns: number; infos: number }, r: any) => ({
      errors: acc.errors + r.summary.errors,
      warns:  acc.warns  + r.summary.warns,
      infos:  acc.infos  + r.summary.infos,
    }),
    { errors: 0, warns: 0, infos: 0 },
  );

  return jsonResponse({
    success:    true,
    ok:         allOk,
    cliente_id: clienteId,
    summary:    { entries: reports.length, ...totals },
    reports,
    timestamp:  new Date().toISOString(),
  });
}

/**
 * [F10.2 + F-12] POST /admin/invalidate-config
 *
 * Body: { cliente_id: uuid, config_id?: uuid }
 *
 * Requer auth tenant-bound (modo `tenant_key`). Antes em modo legacy_global
 * qualquer holder da N8N_API_KEY podia invalidar cache de QUALQUER tenant —
 * vetor de DoS por amplificação (cada call força reload do RPC pesado).
 * Agora rejeita em modo legacy.
 */
export async function handleInvalidateConfig(
  _supabase: any,
  body: any,
  clienteId: string,
  authMode?: 'tenant_key' | 'legacy_global',
): Promise<Response> {
  if (authMode !== 'tenant_key') {
    return jsonResponse({
      success:    false,
      codigo_erro: 'TENANT_KEY_REQUIRED',
      error:       'Endpoint /invalidate-config exige API key tenant-bound (api_keys table). Modo legacy_global não autorizado.',
    }, 403);
  }

  const configId = typeof body?.config_id === 'string' && body.config_id.length > 0
    ? body.config_id
    : undefined;
  const removed = invalidateCache(clienteId, configId);
  return jsonResponse({
    success:   true,
    cliente_id: clienteId,
    config_id:  configId ?? null,
    invalidated: removed,
    note:        'Cache invalidado nesta instance. Outras instances quentes podem manter cache até TTL (60s).',
    timestamp:   new Date().toISOString(),
  });
}
