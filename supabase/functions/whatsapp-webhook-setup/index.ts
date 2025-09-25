import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para configurar webhook na Evolution API
async function configurarWebhook() {
  try {
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL') || 'https://evolutionapi.inovaia.online';
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || 'grozNCsxwy32iYir20LRw7dfIRNPI8UZ';
    const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'Endogastro';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL não configurada');
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-agent`;
    
    console.log(`🔧 Configurando webhook: ${webhookUrl}`);

    // Configurar webhook para mensagens
    const webhookConfig = {
      webhook: {
        url: webhookUrl,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE'
        ],
        webhook_by_events: true,
        webhook_base64: false
      }
    };

    const response = await fetch(`${evolutionUrl}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify(webhookConfig)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ao configurar webhook: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    return {
      success: true,
      webhook_url: webhookUrl,
      config: webhookConfig,
      result
    };

  } catch (error) {
    console.error('❌ Erro ao configurar webhook:', error);
    throw error;
  }
}

// Função para verificar status da instância
async function verificarStatus() {
  try {
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL') || 'https://evolutionapi.inovaia.online';
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || 'grozNCsxwy32iYir20LRw7dfIRNPI8UZ';
    const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'Endogastro';

    const response = await fetch(`${evolutionUrl}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Erro ao verificar status: ${response.status}`);
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('❌ Erro ao verificar status:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'setup';

    let result;

    switch (action) {
      case 'setup':
        result = await configurarWebhook();
        break;
      
      case 'status':
        result = await verificarStatus();
        break;
      
      case 'test':
        // Teste simples
        result = {
          success: true,
          message: 'Webhook setup function está funcionando',
          timestamp: new Date().toISOString(),
          environment: {
            evolution_url: Deno.env.get('EVOLUTION_API_URL'),
            instance: Deno.env.get('EVOLUTION_INSTANCE_NAME'),
            supabase_url: Deno.env.get('SUPABASE_URL')
          }
        };
        break;
      
      default:
        throw new Error(`Ação não reconhecida: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro na configuração:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error?.message || 'Erro desconhecido',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});