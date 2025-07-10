import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🚀 NOVA EDGE FUNCTION - BLOQUEIO AGENDA INICIADA');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('🌐 Método:', req.method);

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
    // Configurar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('🔧 Configurações:', {
      url: !!supabaseUrl,
      serviceKey: !!supabaseServiceKey
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      console.log('❌ Configurações ausentes');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuração do servidor incompleta' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ Cliente Supabase criado');

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

    // Inserir bloqueio na tabela
    console.log('💾 Criando bloqueio...');
    
    const { data: bloqueio, error: bloqueioError } = await supabase
      .from('bloqueios_agenda')
      .insert({
        medico_id: medicoId,
        data_inicio: dataInicio,
        data_fim: dataFim,
        motivo: motivo,
        criado_por: 'recepcionista'
      })
      .select()
      .single();

    if (bloqueioError) {
      console.log('❌ Erro ao criar bloqueio:', bloqueioError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro ao criar bloqueio: ${bloqueioError.message}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Bloqueio criado com sucesso:', bloqueio.id);

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