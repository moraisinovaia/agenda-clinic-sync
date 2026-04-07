import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

/**
 * v1.1.0 - LLM Agent API Dr. Marcelo D'Carli
 * 
 * Proxy que redireciona para a API principal com config_id específico
 * Usa mesmos dados de agendamentos do IPADO, mas com configurações próprias
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * DADOS DO MÉDICO
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Nome: MARCELO DE'CARLI CAVALCANTI
 * CRM: 15056/PE
 * RQE Cardiologia: 67
 * RQE Ergometria: 16.683
 * 
 * Empresa: DE CARLI SERVIÇOS DE SAUDE LTDA
 * CNPJ: 09.637.244/0001-54
 * Email: drmarcelodecarli@gmail.com
 * Instagram: @drmarcelodecarli
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * LOCAL DE ATENDIMENTO
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Endereço: Rua Tobias Barreto, 164, 2º andar, Prédio IPADO, Centro, Petrolina/PE
 * WhatsApp: (87) 98112-6744
 * Secretárias: Jeniffe e Luh
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * CONVÊNIOS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ACEITOS:
 * - UNIMED VSF, UNIMED NACIONAL, UNIMED REGIONAL, UNIMED INTERCAMBIO
 * - UNIMED 40% (paga na clínica), UNIMED 20% (paga na clínica)
 * - HGU
 * - CASEMBRAPA (apenas periódico)
 * 
 * PARCEIROS (consultar diretamente):
 * - MEDCLIN, MEDPREV, SEDILAB, CLÍNICA VIDA, CLINCENTER, SERTÃO SAÚDE
 * 
 * NÃO ACEITOS:
 * - SULAMERICA, CASSI, BRADESCO, CAMED, FUSEX, CAPESAUDE, entre outros
 * - Paciente pode fazer particular e solicitar reembolso
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * EXAMES E HORÁRIOS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * CONSULTA CARDIOLÓGICA:
 * - Segunda a Sexta (manhã): 07:00-12:00, atendimento 07:45, limite 9 pacientes
 * - Segunda e Quarta (tarde): 13:00-17:00, atendimento 13:45, limite 9 pacientes
 * 
 * TESTE ERGOMÉTRICO:
 * - Quarta e Sexta (manhã): 07:00-10:30, atendimento 07:30, limite 13 pacientes
 * - Terça e Quinta (tarde): 13:00-15:30, atendimento 13:30, limite 13 pacientes
 * - Valores: Particular R$ 240 (mín. R$ 220), UNIMED 40%: R$ 54, UNIMED 20%: R$ 26
 * - Resultado no mesmo dia
 * 
 * ECG:
 * - Sem agendamento, comparecer durante horário de atendimento
 * 
 * MAPA 24H / MRPA:
 * - Agendar via WhatsApp (87) 98112-6744
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * CONFIGURAÇÃO TÉCNICA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Config ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890 (Consultório Dr. Marcelo D'Carli)
 * Cliente ID: 2bfb98b5-ae41-4f96-8ba7-acc797c22054 (IPADO - dados compartilhados)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-api-key',
}

// Config ID do "Consultório Dr. Marcelo D'Carli" (config real no banco)
const CONFIG_ID_MARCELO = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// Cliente ID do IPADO (para acessar mesmos pacientes/agendamentos)
const CLIENTE_ID_IPADO = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';

// Escopo explícito do canal exclusivo do Dr. Marcelo
const MARCELO_DOCTOR_SCOPE_IDS = [
  '1e110923-50df-46ff-a57a-29d88e372900', // Dr. Marcelo D'Carli
  'e6453b94-840d-4adf-ab0f-fc22be7cd7f5', // MAPA - Dr. Marcelo
  '9d5d0e63-098b-4282-aa03-db3c7e012579', // Teste Ergométrico - Dr. Marcelo
];

const MARCELO_DOCTOR_SCOPE_NAMES = [
  "Dr. Marcelo D'Carli",
  'MAPA - Dr. Marcelo',
  'Teste Ergométrico - Dr. Marcelo',
];

const MARCELO_ALLOWED_SERVICES = [
  'Consulta Cardiológica',
  'Retorno Cardiológico',
  'ECG (Eletrocardiograma)',
  'Teste Ergométrico',
  'MAPA 24H',
  'MRPA',
  'Parecer Cardiológico',
];

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
    console.error('❌ [MARCELO PROXY] Unauthorized: Invalid or missing API key');
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Invalid API Key' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    
    // Extrair ação do path (ex: /availability, /schedule, etc)
    let action = '';
    if (pathSegments.length > 0) {
      action = pathSegments[pathSegments.length - 1];
      // Se a última parte for o nome da função, não há ação
      if (action === 'llm-agent-api-marcelo') {
        action = '';
      }
    }

    console.log(`🔄 [MARCELO PROXY v1.1.0] Redirecionando: ${req.method} /${action || '(root)'}`);
    console.log(`📍 [MARCELO PROXY] Config ID: ${CONFIG_ID_MARCELO}`);
    console.log(`🏥 [MARCELO PROXY] Cliente ID (IPADO): ${CLIENTE_ID_IPADO}`);
    
    // Parse body se POST
    let body: any = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
        // N8N pode enviar array, pegar primeiro elemento
        if (Array.isArray(body) && body.length > 0) {
          body = body[0];
        }
      } catch (e) {
        console.log(`⚠️ [MARCELO PROXY] Sem body ou body inválido`);
        body = {};
      }
    }

    // Injetar config_id específico e cliente_id IPADO
    const enrichedBody = {
      ...body,
      config_id: CONFIG_ID_MARCELO,
      cliente_id: CLIENTE_ID_IPADO,
      allowed_doctor_ids: MARCELO_DOCTOR_SCOPE_IDS,
      allowed_doctor_names: MARCELO_DOCTOR_SCOPE_NAMES,
      allowed_services: MARCELO_ALLOWED_SERVICES,
      channel_label: 'dr_marcelo_exclusivo',
    };

    console.log(`📦 [MARCELO PROXY] Body enriquecido com config_id, cliente_id e escopo`);
    console.log(`📝 [MARCELO PROXY] Ação: ${action || 'root'}, Medico solicitado: ${body.medico || body.medico_nome || 'não especificado'}`);

    // Construir URL de destino
    const targetUrl = action ? `${MAIN_API_URL}/${action}` : MAIN_API_URL;

    console.log(`🎯 [MARCELO PROXY] Chamando: ${targetUrl}`);

    // Fazer requisição para API principal
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: req.method === 'POST' ? JSON.stringify(enrichedBody) : undefined
    });

    const responseData = await response.text();
    console.log(`✅ [MARCELO PROXY] Status da resposta: ${response.status}`);

    // Retornar resposta da API principal
    return new Response(responseData, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Proxy-From': 'llm-agent-api-marcelo',
        'X-Config-Id': CONFIG_ID_MARCELO,
        'X-Proxy-Version': '1.1.0'
      }
    });

  } catch (error: any) {
    console.error(`❌ [MARCELO PROXY] Erro:`, error.message);
    console.error(`❌ [MARCELO PROXY] Stack:`, error.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'PROXY_ERROR',
      message: 'Erro ao processar requisição para Dr. Marcelo.',
      detalhes: error.message,
      codigo_erro: 'MARCELO_PROXY_ERROR',
      proxy_version: '1.1.0',
      config_id: CONFIG_ID_MARCELO,
      timestamp: new Date().toISOString()
    }), {
      status: 200, // Retornar 200 para N8N processar
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
