import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função auxiliar para testar conectividade
async function testSupabaseConnection(supabase: any) {
  try {
    console.log('🧪 Testando conectividade básica...');
    const { data, error } = await supabase
      .from('medicos')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('❌ Erro no teste de conectividade:', error);
      return { success: false, error };
    }
    
    console.log('✅ Teste de conectividade bem-sucedido');
    return { success: true };
  } catch (err) {
    console.log('❌ Exceção no teste de conectividade:', err);
    return { success: false, error: err };
  }
}

// Função para tentar inserção com retry
async function insertBloqueioWithRetry(supabase: any, data: any, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🔄 Tentativa ${attempt}/${maxRetries} de inserção...`);
    
    try {
      const { data: result, error } = await supabase
        .from('bloqueios_agenda')
        .insert(data)
        .select()
        .single();

      if (error) {
        console.log(`❌ Erro na tentativa ${attempt}:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        
        if (attempt === maxRetries) {
          return { data: null, error };
        }
        
        // Aguardar antes da próxima tentativa
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      console.log(`✅ Inserção bem-sucedida na tentativa ${attempt}`);
      return { data: result, error: null };
    } catch (err) {
      console.log(`❌ Exceção na tentativa ${attempt}:`, err);
      if (attempt === maxRetries) {
        return { data: null, error: err };
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

serve(async (req) => {
  console.log('🚀 BLOQUEIO AGENDA - VERSÃO ROBUSTA INICIADA');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('🌐 Método:', req.method);
  console.log('🔗 URL:', req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled');
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.log('❌ Método não permitido:', req.method);
    return new Response(
      JSON.stringify({ success: false, error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 1. VALIDAÇÃO EXPLÍCITA DAS VARIÁVEIS DE AMBIENTE
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('🔧 Configurações detalhadas:', {
      url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'AUSENTE',
      serviceKey: supabaseServiceKey ? `${supabaseServiceKey.substring(0, 10)}...` : 'AUSENTE',
      urlLength: supabaseUrl?.length || 0,
      keyLength: supabaseServiceKey?.length || 0
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      console.log('❌ Configurações ausentes - variáveis de ambiente não encontradas');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuração do servidor incompleta - variáveis de ambiente ausentes',
          details: {
            hasUrl: !!supabaseUrl,
            hasKey: !!supabaseServiceKey
          }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. CRIAR CLIENTE COM CONFIGURAÇÕES EXPLÍCITAS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      }
    });
    console.log('✅ Cliente Supabase criado com headers personalizados');

    // 3. TESTE DE CONECTIVIDADE BÁSICA
    const connectionTest = await testSupabaseConnection(supabase);
    if (!connectionTest.success) {
      console.log('❌ Falha no teste de conectividade');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Falha na conectividade com Supabase',
          details: connectionTest.error
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ler corpo da requisição
    const body = await req.json();
    console.log('📋 Dados recebidos:', body);

    const { medicoId, dataInicio, dataFim, motivo } = body;

    // Validações básicas
    if (!medicoId || !dataInicio || !dataFim || !motivo) {
      console.log('❌ Dados obrigatórios ausentes');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Todos os campos são obrigatórios' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Verificando se médico existe...');
    
    // Verificar se médico existe
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id, nome')
      .eq('id', medicoId)
      .single();

    if (medicoError || !medico) {
      console.log('❌ Médico não encontrado:', medicoError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Médico não encontrado' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Médico encontrado:', medico.nome);

    // 4. PREPARAR DADOS PARA INSERÇÃO
    const insertData = {
      medico_id: medicoId,
      data_inicio: dataInicio,
      data_fim: dataFim,
      motivo: motivo,
      criado_por: 'recepcionista'
    };
    
    console.log('📝 Dados preparados para inserção:', insertData);

    // 5. INSERIR BLOQUEIO COM RETRY E LOGS DETALHADOS
    console.log('💾 Iniciando processo de criação de bloqueio...');
    
    const { data: bloqueio, error: bloqueioError } = await insertBloqueioWithRetry(supabase, insertData);

    if (bloqueioError || !bloqueio) {
      console.log('❌ FALHA DEFINITIVA na criação do bloqueio:', {
        error: bloqueioError,
        errorType: typeof bloqueioError,
        errorConstructor: bloqueioError?.constructor?.name,
        message: bloqueioError?.message || 'Erro desconhecido',
        details: bloqueioError?.details || 'Sem detalhes',
        hint: bloqueioError?.hint || 'Sem dica',
        code: bloqueioError?.code || 'Sem código'
      });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Falha ao criar bloqueio após múltiplas tentativas',
          details: {
            message: bloqueioError?.message || 'Erro desconhecido',
            code: bloqueioError?.code || 'UNKNOWN',
            hint: bloqueioError?.hint || 'Verifique os logs para mais detalhes'
          }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Bloqueio criado com sucesso:', {
      id: bloqueio.id,
      medico_id: bloqueio.medico_id,
      data_inicio: bloqueio.data_inicio,
      data_fim: bloqueio.data_fim
    });

    // Buscar agendamentos afetados
    console.log('🔍 Buscando agendamentos afetados...');
    
    const { data: agendamentos, error: agendamentosError } = await supabase
      .from('agendamentos')
      .select('id, data_agendamento, hora_agendamento')
      .eq('medico_id', medicoId)
      .gte('data_agendamento', dataInicio)
      .lte('data_agendamento', dataFim)
      .eq('status', 'agendado');

    if (agendamentosError) {
      console.log('⚠️ Erro ao buscar agendamentos:', agendamentosError);
    } else {
      console.log(`📋 Encontrados ${agendamentos?.length || 0} agendamentos para cancelar`);
    }

    // Retornar sucesso
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Bloqueio criado com sucesso',
        data: {
          bloqueio_id: bloqueio.id,
          medico: medico.nome,
          agendamentos_afetados: agendamentos?.length || 0,
          periodo: `${dataInicio} até ${dataFim}`
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ ERRO GERAL:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Erro interno: ${error.message}` 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});