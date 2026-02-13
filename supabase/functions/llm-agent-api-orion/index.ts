import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

/**
 * v1.0.0 - LLM Agent API Orion (Proxy para API Principal)
 * 
 * Esta função redireciona todas as chamadas para a llm-agent-api principal,
 * passando o config_id da Clínica Orion automaticamente.
 * 
 * A Clínica Orion é uma filial da IPADO com WhatsApp separado.
 * WhatsApp: 87 8150-0808
 * Telefone: 87 3024-1274
 * Endereço: Av. Presidente Tancredo Neves, 1019 - Centro, Petrolina-PE
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

// 🏥 Config ID da Clínica Orion
const CLINICA_ORION_CONFIG_ID = '223a7ffd-337b-4379-95b6-85bed89e47d0';

// Cliente ID próprio da Clínica Orion (separado do IPADO)
const CLIENTE_ID_ORION = 'e8f7d6c5-b4a3-4c2d-9e1f-0a1b2c3d4e5f';

// URL da API principal
const MAIN_API_URL = 'https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validar API Key
  const apiKey = req.headers.get('x-api-key');
  const expectedApiKey = Deno.env.get('N8N_API_KEY');
  if (!apiKey || apiKey !== expectedApiKey) {
    console.error('❌ [ORION PROXY] Unauthorized: Invalid or missing API key');
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Invalid API Key' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    
    // Extrair a action do path (ex: /llm-agent-api-orion/availability -> availability)
    let action = '';
    if (pathSegments.length > 0) {
      action = pathSegments[pathSegments.length - 1];
      // Se o último segmento é o nome da função, não há action específica
      if (action === 'llm-agent-api-orion') {
        action = '';
      }
    }

    console.log(`🔄 [ORION PROXY v1.0.0] Redirecionando: ${req.method} /${action || '(root)'}`);
    
    // Obter o body da requisição original
    let body: any = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
        console.log(`📥 [ORION PROXY] Body ORIGINAL:`, JSON.stringify(body));
        
        // Normalizar body se for array (n8n às vezes envia [{...}] ao invés de {...})
        if (Array.isArray(body) && body.length > 0) {
          console.log('⚠️ [ORION PROXY] Body recebido como array, extraindo primeiro elemento');
          body = body[0];
        }
      } catch (e) {
        console.log(`⚠️ [ORION PROXY] Body vazio ou inválido:`, e.message);
        body = {};
      }
    }

    // Injetar config_id e cliente_id da Clínica Orion no body
    const enrichedBody = {
      ...body,
      config_id: CLINICA_ORION_CONFIG_ID,
      cliente_id: CLIENTE_ID_ORION
    };

    console.log(`📦 [ORION PROXY] Body enriquecido com config_id: ${CLINICA_ORION_CONFIG_ID}`);
    console.log(`📤 [ORION PROXY] Body completo:`, JSON.stringify(enrichedBody));

    // Construir URL da API principal
    const targetUrl = action ? `${MAIN_API_URL}/${action}` : MAIN_API_URL;
    console.log(`📡 [ORION PROXY] Chamando: ${targetUrl}`);

    // Fazer a chamada para a API principal
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: req.method === 'POST' ? JSON.stringify(enrichedBody) : undefined
    });

    // Obter resposta da API principal
    const responseData = await response.text();
    
    console.log(`✅ [ORION PROXY] Resposta recebida: ${response.status}`);

    // Retornar resposta com os headers CORS
    return new Response(responseData, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Proxy-From': 'llm-agent-api-orion',
        'X-Config-Id': CLINICA_ORION_CONFIG_ID
      }
    });

  } catch (error: any) {
    console.error(`❌ [ORION PROXY] Erro:`, error.message);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'PROXY_ERROR',
      message: 'Erro ao processar requisição. Tente novamente.',
      codigo_erro: 'ORION_PROXY_ERROR',
      proxy_version: '1.0.0',
      config_id: CLINICA_ORION_CONFIG_ID,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
