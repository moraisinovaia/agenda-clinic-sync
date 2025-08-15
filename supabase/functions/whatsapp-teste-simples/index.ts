// Teste simples e direto para WhatsApp - compatível com Supabase Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function enviarMensagemTeste(celular: string): Promise<{success: boolean, message: string, details?: any}> {
  console.log(`🧪 Iniciando teste direto para ${celular}`);
  
  try {
    // Verificar secrets
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY'); 
    const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');
    
    console.log(`📋 Secrets check: URL=${!!evolutionUrl}, KEY=${!!apiKey}, INSTANCE=${!!instanceName}`);
    
    if (!evolutionUrl || !apiKey || !instanceName) {
      return {
        success: false,
        message: 'Secrets não configurados: ' + [
          !evolutionUrl && 'EVOLUTION_API_URL',
          !apiKey && 'EVOLUTION_API_KEY', 
          !instanceName && 'EVOLUTION_INSTANCE_NAME'
        ].filter(Boolean).join(', ')
      };
    }
    
    // Formatar número
    const numeroLimpo = celular.replace(/\D/g, '');
    const numeroCompleto = numeroLimpo.startsWith('55') ? numeroLimpo : `55${numeroLimpo}`;
    
    console.log(`📞 Número formatado: ${numeroCompleto}`);
    
    // Mensagem de teste
    const mensagem = `🧪 TESTE DIRETO WHATSAPP ENDOGASTRO

⏰ ${new Date().toLocaleString('pt-BR')}
🔧 Sistema funcionando corretamente!

Esta é uma mensagem de teste automático.
Se você recebeu, o WhatsApp está operacional! ✅

_Mensagem automática - Endogastro_`;

    // URL da API
    const apiUrl = `${evolutionUrl}/message/sendText/${instanceName}`;
    
    console.log(`🌐 Enviando para: ${apiUrl}`);
    
    // Fazer requisição
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        number: numeroCompleto,
        text: mensagem
      })
    });
    
    console.log(`📡 Response status: ${response.status}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Sucesso:', result);
      
      return {
        success: true,
        message: `WhatsApp enviado com sucesso para ${numeroCompleto}!`,
        details: result
      };
    } else {
      const errorText = await response.text();
      console.error(`❌ Erro HTTP ${response.status}:`, errorText);
      
      return {
        success: false,
        message: `Erro na API: HTTP ${response.status} - ${errorText}`,
        details: { status: response.status, error: errorText }
      };
    }
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro geral:', errorMsg);
    
    return {
      success: false,
      message: `Erro de sistema: ${errorMsg}`,
      details: { error: errorMsg }
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { celular } = await req.json();
    
    if (!celular) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Celular é obrigatório'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🚀 Iniciando teste para ${celular}`);
    
    const resultado = await enviarMensagemTeste(celular);
    
    // Salvar log
    await supabase.from('system_logs').insert({
      timestamp: new Date().toISOString(),
      level: resultado.success ? 'info' : 'error',
      message: `Teste WhatsApp ${resultado.success ? 'enviado' : 'falhou'}: ${resultado.message}`,
      context: 'WHATSAPP_TESTE_SIMPLES',
      data: { celular, resultado }
    });
    
    console.log(`${resultado.success ? '✅' : '❌'} Resultado: ${resultado.message}`);

    return new Response(JSON.stringify(resultado), {
      status: resultado.success ? 200 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro na função:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})