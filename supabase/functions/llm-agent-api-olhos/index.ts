import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

/**
 * v1.0.0 - LLM Agent API Clínica Olhos (Proxy para API Principal)
 * 
 * Proxy que redireciona para a API principal com config_id e cliente_id específicos.
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * DADOS DA CLÍNICA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Nome: Clínica Olhos
 * Config ID: 0572445e-b4f3-4166-972d-d883d0fdd37c
 * Cliente ID: d7d7b7cf-4ec0-437b-8377-d7555fc5ee6a
 * Médicos: 7 ativos
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * PENDÊNCIAS
 * ═══════════════════════════════════════════════════════════════════════════
 * - WhatsApp, telefone e endereço (preencher na llm_clinic_config)
 * - Mensagens personalizadas (opcional, na llm_mensagens)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const CONFIG_ID_OLHOS = '0572445e-b4f3-4166-972d-d883d0fdd37c';
const CLIENTE_ID_OLHOS = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a';
const MAIN_API_URL = 'https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    
    let action = '';
    if (pathSegments.length > 0) {
      action = pathSegments[pathSegments.length - 1];
      if (action === 'llm-agent-api-olhos') {
        action = '';
      }
    }

    console.log(`🔄 [OLHOS PROXY v1.0.0] Redirecionando: ${req.method} /${action || '(root)'}`);
    console.log(`📍 [OLHOS PROXY] Config ID: ${CONFIG_ID_OLHOS}`);
    console.log(`🏥 [OLHOS PROXY] Cliente ID: ${CLIENTE_ID_OLHOS}`);
    
    let body: any = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
        if (Array.isArray(body) && body.length > 0) {
          console.log('⚠️ [OLHOS PROXY] Body recebido como array, extraindo primeiro elemento');
          body = body[0];
        }
      } catch (e) {
        console.log(`⚠️ [OLHOS PROXY] Sem body ou body inválido`);
        body = {};
      }
    }

    const enrichedBody = {
      ...body,
      config_id: CONFIG_ID_OLHOS,
      cliente_id: CLIENTE_ID_OLHOS
    };

    console.log(`📦 [OLHOS PROXY] Body enriquecido com config_id e cliente_id`);
    console.log(`📝 [OLHOS PROXY] Ação: ${action || 'root'}, Medico: ${body.medico || body.medico_nome || 'não especificado'}`);

    const targetUrl = action ? `${MAIN_API_URL}/${action}` : MAIN_API_URL;
    console.log(`🎯 [OLHOS PROXY] Chamando: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method === 'POST' ? JSON.stringify(enrichedBody) : undefined
    });

    const responseData = await response.text();
    console.log(`✅ [OLHOS PROXY] Status da resposta: ${response.status}`);

    return new Response(responseData, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Proxy-From': 'llm-agent-api-olhos',
        'X-Config-Id': CONFIG_ID_OLHOS,
        'X-Proxy-Version': '1.0.0'
      }
    });

  } catch (error: any) {
    console.error(`❌ [OLHOS PROXY] Erro:`, error.message);
    console.error(`❌ [OLHOS PROXY] Stack:`, error.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'PROXY_ERROR',
      message: 'Erro ao processar requisição para Clínica Olhos.',
      detalhes: error.message,
      codigo_erro: 'OLHOS_PROXY_ERROR',
      proxy_version: '1.0.0',
      config_id: CONFIG_ID_OLHOS,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
