// ============= CORS HEADERS, API_VERSION E FUNÇÕES DE RESPOSTA =============

// v3.2.0 - Sistema Dinâmico com Logging Estruturado
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

export const API_VERSION = '3.2.0';

// Funções auxiliares
export function successResponse(data: any) {
  return new Response(JSON.stringify({
    success: true,
    timestamp: new Date().toISOString(),
    ...data
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * 🆕 Retorna erro de VALIDAÇÃO DE NEGÓCIO (não erro técnico)
 * Status 200 para que n8n/LLM possa processar a resposta
 */
export function businessErrorResponse(config: {
  codigo_erro: string;
  mensagem_usuario: string;
  detalhes?: any;
  sugestoes?: any;
}) {
  return new Response(JSON.stringify({
    success: false,
    codigo_erro: config.codigo_erro,
    mensagem_usuario: config.mensagem_usuario,
    mensagem_whatsapp: config.mensagem_usuario, // Compatibilidade
    detalhes: config.detalhes || {},
    sugestoes: config.sugestoes || null,
    timestamp: new Date().toISOString()
  }), {
    status: 200, // ✅ Status 200 para n8n processar
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

export function errorResponse(message: string, codigoErro = 'ERRO_GENERICO') {
  return new Response(JSON.stringify({
    success: false,
    codigo_erro: codigoErro,
    error: message,
    mensagem_usuario: message,
    mensagem_whatsapp: message,
    timestamp: new Date().toISOString()
  }), {
    status: 200, // ✅ Sempre 200 para n8n/agente processar JSON
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
