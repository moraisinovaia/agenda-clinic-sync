import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestResult {
  test_id: string;
  timestamp: string;
  success: boolean;
  steps: {
    secrets_check: { success: boolean; message: string };
    connectivity_test: { success: boolean; message: string; response_time_ms?: number };
    message_send: { success: boolean; message: string; evolution_response?: any };
  };
  overall_message: string;
  recommendations?: string[];
}

async function testWhatsAppSystem(celular: string): Promise<TestResult> {
  const testId = `test-${Date.now()}`;
  const timestamp = new Date().toISOString();
  
  const result: TestResult = {
    test_id: testId,
    timestamp,
    success: false,
    steps: {
      secrets_check: { success: false, message: '' },
      connectivity_test: { success: false, message: '' },
      message_send: { success: false, message: '' }
    },
    overall_message: '',
    recommendations: []
  };
  
  try {
    // Passo 1: Verificar secrets
    console.log('🔑 Verificando secrets...');
    
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY');
    const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');
    
    if (!evolutionUrl || !apiKey || !instanceName) {
      result.steps.secrets_check = {
        success: false,
        message: `Secrets faltando: ${!evolutionUrl ? 'EVOLUTION_API_URL ' : ''}${!apiKey ? 'EVOLUTION_API_KEY ' : ''}${!instanceName ? 'EVOLUTION_INSTANCE_NAME' : ''}`
      };
      result.overall_message = 'Falha na verificação de secrets';
      return result;
    }
    
    result.steps.secrets_check = {
      success: true,
      message: 'Todos os secrets encontrados'
    };
    
    // Passo 2: Teste de conectividade
    console.log('🌐 Testando conectividade...');
    
    const connectivityStart = Date.now();
    
    try {
      const testResponse = await fetch(`${evolutionUrl}/instance/fetchInstances`, {
        method: 'GET',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      });
      
      const responseTime = Date.now() - connectivityStart;
      
      if (testResponse.ok) {
        result.steps.connectivity_test = {
          success: true,
          message: `API acessível (${responseTime}ms)`,
          response_time_ms: responseTime
        };
      } else {
        result.steps.connectivity_test = {
          success: false,
          message: `API retornou HTTP ${testResponse.status}: ${testResponse.statusText}`,
          response_time_ms: responseTime
        };
        result.overall_message = 'Evolution API não está respondendo adequadamente';
        return result;
      }
      
    } catch (connectError) {
      result.steps.connectivity_test = {
        success: false,
        message: `Erro de conectividade: ${connectError instanceof Error ? connectError.message : 'Erro desconhecido'}`
      };
      result.overall_message = 'Falha na conectividade com Evolution API';
      return result;
    }
    
    // Passo 3: Teste de envio de mensagem
    console.log('📱 Testando envio de mensagem...');
    
    const numeroLimpo = celular.replace(/\D/g, '');
    const numeroCompleto = numeroLimpo.startsWith('55') ? numeroLimpo : `55${numeroLimpo}`;
    
    const mensagemTeste = `🧪 TESTE AUTOMATICO WHATSAPP
    
⏰ Horário: ${new Date().toLocaleString('pt-BR')}
🔍 Test ID: ${testId}
    
Esta é uma mensagem de teste do sistema de WhatsApp da Endogastro.
Se você recebeu esta mensagem, significa que o sistema está funcionando corretamente!
    
_Mensagem de teste automático - Endogastro_`;
    
    try {
      const sendResponse = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify({
          number: numeroCompleto,
          text: mensagemTeste
        }),
        signal: AbortSignal.timeout(15000)
      });
      
      if (sendResponse.ok) {
        const evolutionResult = await sendResponse.json();
        
        result.steps.message_send = {
          success: true,
          message: 'Mensagem enviada com sucesso!',
          evolution_response: evolutionResult
        };
        
        result.success = true;
        result.overall_message = `✅ Teste completo realizado com sucesso! Mensagem enviada para ${numeroCompleto}`;
        
      } else {
        const errorText = await sendResponse.text();
        result.steps.message_send = {
          success: false,
          message: `Falha no envio: HTTP ${sendResponse.status} - ${errorText}`
        };
        result.overall_message = 'Sistema acessível mas falha no envio da mensagem';
      }
      
    } catch (sendError) {
      result.steps.message_send = {
        success: false,
        message: `Erro no envio: ${sendError instanceof Error ? sendError.message : 'Erro desconhecido'}`
      };
      result.overall_message = 'Falha no envio da mensagem de teste';
    }
    
  } catch (error) {
    result.overall_message = `Erro geral no teste: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
  }
  
  // Adicionar recomendações baseadas nos resultados
  if (!result.success) {
    if (!result.steps.secrets_check.success) {
      result.recommendations?.push('Configure os secrets da Evolution API no Supabase Dashboard');
    }
    if (!result.steps.connectivity_test.success) {
      result.recommendations?.push('Verifique se a Evolution API está rodando e acessível');
      result.recommendations?.push('Confirme se a URL da API está correta');
    }
    if (!result.steps.message_send.success && result.steps.connectivity_test.success) {
      result.recommendations?.push('Verifique se a instância do WhatsApp está conectada');
      result.recommendations?.push('Confirme o nome da instância nas configurações');
    }
  }
  
  return result;
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

    console.log('🧪 Iniciando teste direto do WhatsApp...');

    const body = await req.json();
    const { celular } = body;

    if (!celular) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Número de celular é obrigatório' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Executar teste completo
    const testResult = await testWhatsAppSystem(celular);
    
    // Log do resultado
    await supabase.from('system_logs').insert({
      timestamp: new Date().toISOString(),
      level: testResult.success ? 'info' : 'error',
      message: `Teste direto WhatsApp ${testResult.success ? 'realizado' : 'falhou'}: ${testResult.overall_message}`,
      context: 'WHATSAPP_DIRECT_TEST',
      data: testResult
    });

    console.log(`${testResult.success ? '✅' : '❌'} Teste concluído:`, testResult.overall_message);

    return new Response(JSON.stringify(testResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro no teste direto:', error);
    
    const errorResult = {
      test_id: `error-${Date.now()}`,
      timestamp: new Date().toISOString(),
      success: false,
      overall_message: `Erro crítico no teste: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      error: true
    };

    return new Response(JSON.stringify(errorResult), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})