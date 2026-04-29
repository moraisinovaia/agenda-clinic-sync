// Função temporária para testar a llm-agent-api em produção
// Usa N8N_API_KEY do env e executa cenários reais.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const BASE = 'https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api';

const CLINICS = {
  marcelo: { cliente_id: '2bfb98b5-ae41-4f96-8ba7-acc797c22054', config_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', label: "Dr. Marcelo D'Carli" },
  ipado:   { cliente_id: '2bfb98b5-ae41-4f96-8ba7-acc797c22054', config_id: '20b48124-ae41-4e54-8a7e-3e236b8b4829', label: 'IPADO' },
  venus:   { cliente_id: '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a', label: 'Vênus' },
  olhos:   { cliente_id: 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a', config_id: '0572445e-b4f3-4166-972d-d883d0fdd37c', label: 'Olhos' },
  orion:   { cliente_id: 'e8f7d6c5-b4a3-4c2d-9e1f-0a1b2c3d4e5f', config_id: '223a7ffd-337b-4379-95b6-85bed89e47d0', label: 'Orion' },
  endogastro: { cliente_id: '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', label: 'Endogastro' },
  prooftalmo: { cliente_id: '0b6a0a35-0059-4a0c-9fb8-413b6253c2ad', label: 'Prooftalmo' },
};

async function call(action: string, body: Record<string, unknown>, apiKey: string) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* keep text */ }
    return {
      action,
      status: res.status,
      duration_ms: Date.now() - t0,
      success: json?.success ?? null,
      codigo_erro: json?.codigo_erro ?? null,
      message: json?.message ?? json?.mensagem_usuario ?? null,
      keys: json && typeof json === 'object' ? Object.keys(json).slice(0, 12) : null,
      sample: json
        ? JSON.stringify(json).slice(0, 400)
        : text.slice(0, 400),
    };
  } catch (err: any) {
    return { action, error: err.message, duration_ms: Date.now() - t0 };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const apiKey = Deno.env.get('N8N_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'N8N_API_KEY missing' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results: Record<string, any[]> = {};

  for (const [key, c] of Object.entries(CLINICS)) {
    const ctx: any = { cliente_id: c.cliente_id };
    if ('config_id' in c) ctx.config_id = (c as any).config_id;

    const tests = [
      call('clinic-info', ctx, apiKey),
      call('list-doctors', ctx, apiKey),
      call('list-appointments', { ...ctx, limit: 3 }, apiKey),
    ];
    results[key] = await Promise.all(tests);
  }

  // Testes específicos do Dr. Marcelo (chat + availability)
  const m = CLINICS.marcelo;
  const marceloExtra = await Promise.all([
    call('availability', {
      cliente_id: m.cliente_id, config_id: m.config_id,
      medico_nome: 'Marcelo', atendimento_nome: 'consulta', buscar_proximas: true,
    }, apiKey),
    call('chat', {
      cliente_id: m.cliente_id, config_id: m.config_id,
      phone_paciente: '+5587999990000', nome_paciente: 'Teste QA',
      mensagem: 'oi, gostaria de agendar consulta com dr marcelo',
      estado_atual: 'inicio', dados_coletados: {}, historico_contexto: [],
    }, apiKey),
    call('check-patient', {
      cliente_id: m.cliente_id, config_id: m.config_id,
      phone_paciente: '+5587999990000',
    }, apiKey),
  ]);
  results['marcelo_extra'] = marceloExtra;

  // Validação de segurança: chamada SEM cliente_id
  const securityTest = await call('clinic-info', {}, apiKey);
  // Validação de segurança: API key inválida
  const wrongKey = await call('clinic-info', { cliente_id: m.cliente_id }, 'invalid-key');

  return new Response(JSON.stringify({
    timestamp: new Date().toISOString(),
    results,
    security: { without_cliente_id: securityTest, wrong_api_key: wrongKey },
  }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
