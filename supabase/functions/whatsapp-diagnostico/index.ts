import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DiagnosticResponse {
  timestamp: string;
  secrets_status: {
    evolution_url: boolean;
    evolution_key: boolean; 
    evolution_instance: boolean;
  };
  connectivity: {
    evolution_api_reachable: boolean;
    response_time_ms: number;
    status_code?: number;
    error_details?: string;
  };
  configuration: {
    edge_function_deployed: boolean;
    database_accessible: boolean;
  };
  recommendations: string[];
  overall_status: 'healthy' | 'warning' | 'critical';
}

async function testEvolutionConnectivity(url: string, key: string, instance: string): Promise<{
  reachable: boolean;
  responseTime: number;
  statusCode?: number;
  errorDetails?: string;
}> {
  const startTime = Date.now();
  
  try {
    const testUrl = `${url}/instance/fetchInstances`;
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000) // 10 segundos timeout
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    return {
      reachable: response.ok,
      responseTime,
      statusCode: response.status,
      errorDetails: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
    };
    
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    return {
      reachable: false,
      responseTime,
      errorDetails: error instanceof Error ? error.message : 'Unknown error'
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

    console.log('🔍 Iniciando diagnóstico completo do WhatsApp...');

    const diagnostic: DiagnosticResponse = {
      timestamp: new Date().toISOString(),
      secrets_status: {
        evolution_url: false,
        evolution_key: false,
        evolution_instance: false
      },
      connectivity: {
        evolution_api_reachable: false,
        response_time_ms: 0
      },
      configuration: {
        edge_function_deployed: true, // Se chegamos aqui, a function está deployed
        database_accessible: false
      },
      recommendations: [],
      overall_status: 'critical'
    };

    // 1. Verificar secrets
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');
    const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME');

    diagnostic.secrets_status.evolution_url = !!evolutionUrl;
    diagnostic.secrets_status.evolution_key = !!evolutionKey;
    diagnostic.secrets_status.evolution_instance = !!evolutionInstance;

    if (!evolutionUrl) diagnostic.recommendations.push('❌ EVOLUTION_API_URL não configurada');
    if (!evolutionKey) diagnostic.recommendations.push('❌ EVOLUTION_API_KEY não configurada');
    if (!evolutionInstance) diagnostic.recommendations.push('❌ EVOLUTION_INSTANCE_NAME não configurada');

    // 2. Testar conectividade se temos os secrets necessários
    if (evolutionUrl && evolutionKey && evolutionInstance) {
      console.log('🌐 Testando conectividade com Evolution API...');
      
      const connectivityResult = await testEvolutionConnectivity(evolutionUrl, evolutionKey, evolutionInstance);
      
      diagnostic.connectivity = {
        evolution_api_reachable: connectivityResult.reachable,
        response_time_ms: connectivityResult.responseTime,
        status_code: connectivityResult.statusCode,
        error_details: connectivityResult.errorDetails
      };

      if (!connectivityResult.reachable) {
        diagnostic.recommendations.push(`❌ Evolution API não acessível: ${connectivityResult.errorDetails}`);
      } else if (connectivityResult.responseTime > 5000) {
        diagnostic.recommendations.push(`⚠️ API lenta (${connectivityResult.responseTime}ms) - pode causar timeouts`);
      } else {
        diagnostic.recommendations.push('✅ Evolution API acessível e respondendo bem');
      }
    } else {
      diagnostic.recommendations.push('❌ Não foi possível testar conectividade - secrets faltando');
    }

    // 3. Testar acesso ao banco
    try {
      const { error: dbError } = await supabase
        .from('system_logs')
        .select('id')
        .limit(1);
      
      diagnostic.configuration.database_accessible = !dbError;
      
      if (dbError) {
        diagnostic.recommendations.push(`❌ Erro de acesso ao banco: ${dbError.message}`);
      } else {
        diagnostic.recommendations.push('✅ Banco de dados acessível');
      }
    } catch (error) {
      diagnostic.configuration.database_accessible = false;
      diagnostic.recommendations.push(`❌ Erro de conexão com banco: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    // 4. Determinar status geral
    const criticalIssues = diagnostic.recommendations.filter(r => r.startsWith('❌')).length;
    const warnings = diagnostic.recommendations.filter(r => r.startsWith('⚠️')).length;

    if (criticalIssues > 0) {
      diagnostic.overall_status = 'critical';
    } else if (warnings > 0) {
      diagnostic.overall_status = 'warning';
    } else {
      diagnostic.overall_status = 'healthy';
    }

    // Log do diagnóstico
    await supabase.from('system_logs').insert({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Diagnóstico WhatsApp executado - Status: ${diagnostic.overall_status}`,
      context: 'WHATSAPP_DIAGNOSTIC',
      data: diagnostic
    });

    console.log('✅ Diagnóstico concluído:', diagnostic.overall_status);

    return new Response(JSON.stringify(diagnostic), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
    
    const errorResponse = {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      overall_status: 'critical',
      recommendations: ['❌ Falha crítica no sistema de diagnóstico']
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})