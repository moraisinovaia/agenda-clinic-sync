import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

/**
 * v3.0.0 - LLM Agent API Venus (Proxy para API Principal)
 * 
 * Esta função agora redireciona todas as chamadas para a llm-agent-api principal,
 * passando o cliente_id da Clínica Vênus automaticamente.
 * 
 * As configurações (business_rules, clinic_info, mensagens) são carregadas
 * dinamicamente do banco de dados pela API principal.
 * 
 * Isso garante:
 * - Código centralizado e fácil de manter
 * - Atualizações aplicam para todos os clientes
 * - Configurações editáveis via admin panel
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

// 🏥 ID da Clínica Vênus
const CLINICA_VENUS_ID = '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a';

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
    console.error('❌ [VENUS PROXY] Unauthorized: Invalid or missing API key');
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Invalid API Key' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    
    // Extrair a action do path (ex: /llm-agent-api-venus/availability -> availability)
    // pathSegments pode ser ['llm-agent-api-venus', 'availability'] ou ['availability']
    let action = '';
    if (pathSegments.length > 0) {
      action = pathSegments[pathSegments.length - 1];
      // Se o último segmento é o nome da função, não há action específica
      if (action === 'llm-agent-api-venus') {
        action = '';
      }
    }

    console.log(`🔄 [VENUS PROXY v3.1.0] Redirecionando: ${req.method} /${action || '(root)'}`);
    
    // Obter o body da requisição original
    let body: any = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
        // ✅ Normalizar body se for array (n8n às vezes envia [{...}] ao invés de {...})
        if (Array.isArray(body) && body.length > 0) {
          console.log('⚠️ [VENUS PROXY] Body recebido como array, extraindo primeiro elemento');
          body = body[0];
        }
      } catch (e) {
        console.log(`⚠️ [VENUS PROXY] Body vazio ou inválido`);
        body = {};
      }
    }

    // Injetar cliente_id da Clínica Vênus no body
    const enrichedBody = {
      ...body,
      cliente_id: CLINICA_VENUS_ID
    };

    console.log(`📦 [VENUS PROXY] Body enriquecido com cliente_id, action: ${action || 'root'}`);

    // Construir URL da API principal
    const targetUrl = action ? `${MAIN_API_URL}/${action}` : MAIN_API_URL;

    // Fazer a chamada para a API principal repassando x-api-key
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey!
      },
      body: req.method === 'POST' ? JSON.stringify(enrichedBody) : undefined
    });

    // Obter resposta da API principal
    const responseData = await response.text();
    
    console.log(`✅ [VENUS PROXY] Resposta recebida: ${response.status}`);

    // Retornar resposta com os headers CORS
    return new Response(responseData, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Proxy-From': 'llm-agent-api-venus',
        'X-Cliente-Id': CLINICA_VENUS_ID
      }
    });

  } catch (error: any) {
    console.error(`❌ [VENUS PROXY] Erro:`, error.message);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'PROXY_ERROR',
      message: 'Erro ao processar requisição. Tente novamente.',
      codigo_erro: 'VENUS_PROXY_ERROR',
      proxy_version: '3.0.0',
      cliente_id: CLINICA_VENUS_ID,
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
