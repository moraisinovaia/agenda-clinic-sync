import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🚀 BLOQUEIO AGENDA - VERSÃO EXPANDIDA');
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
    // Criar cliente Supabase simples
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('🔧 Configurações:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseServiceKey
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

    // Cliente Supabase simplificado
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ Cliente Supabase criado');

    // Ler dados da requisição
    const body = await req.json();
    console.log('📋 Dados recebidos:', body);

    const { action, medicoId, dataInicio, dataFim, motivo, bloqueioId } = body;

    // Determinar ação padrão se não especificada
    const acao = action || 'create';
    console.log('🎯 Ação solicitada:', acao);

    // Rota para listar bloqueios ativos
    if (acao === 'list') {
      if (!medicoId) {
        console.log('❌ ID do médico obrigatório para listagem');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'ID do médico é obrigatório para listagem' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('📋 Listando bloqueios ativos para médico:', medicoId);
      
      const { data: bloqueios, error: bloqueiosError } = await supabase
        .from('bloqueios_agenda')
        .select(`
          id,
          data_inicio,
          data_fim,
          motivo,
          created_at,
          criado_por
        `)
        .eq('medico_id', medicoId)
        .eq('status', 'ativo')
        .order('data_inicio', { ascending: true });

      if (bloqueiosError) {
        console.log('❌ Erro ao listar bloqueios:', bloqueiosError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Erro ao listar bloqueios' 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ ${bloqueios?.length || 0} bloqueios encontrados`);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          data: bloqueios || []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rota para remover bloqueio
    if (acao === 'remove') {
      if (!bloqueioId) {
        console.log('❌ ID do bloqueio obrigatório para remoção');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'ID do bloqueio é obrigatório para remoção' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('🗑️ Removendo bloqueio:', bloqueioId);
      
      // Buscar dados do bloqueio antes de remover
      const { data: bloqueio, error: fetchError } = await supabase
        .from('bloqueios_agenda')
        .select('*')
        .eq('id', bloqueioId)
        .eq('status', 'ativo')
        .maybeSingle();

      if (fetchError) {
        console.log('❌ Erro ao buscar bloqueio:', fetchError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Erro ao buscar bloqueio' 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!bloqueio) {
        console.log('❌ Bloqueio não encontrado ou já foi removido');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Bloqueio não encontrado ou já foi removido' 
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 🔥 RESTAURAR agendamentos que foram cancelados por este bloqueio
      console.log('🔄 Restaurando agendamentos cancelados pelo bloqueio...');
      
      const { data: agendamentosCancelados, error: agendamentosError } = await supabase
        .from('agendamentos')
        .select('id, data_agendamento, hora_agendamento')
        .eq('medico_id', bloqueio.medico_id)
        .gte('data_agendamento', bloqueio.data_inicio)
        .lte('data_agendamento', bloqueio.data_fim)
        .eq('status', 'cancelado_bloqueio');

      console.log(`📋 Encontrados ${agendamentosCancelados?.length || 0} agendamentos para restaurar`);

      // Restaurar agendamentos
      if (agendamentosCancelados && agendamentosCancelados.length > 0) {
        const { error: restoreError } = await supabase
          .from('agendamentos')
          .update({ 
            status: 'agendado',
            cancelado_por: null,
            cancelado_por_user_id: null,
            cancelado_em: null
          })
          .in('id', agendamentosCancelados.map(a => a.id));

        if (restoreError) {
          console.log('⚠️ Erro ao restaurar agendamentos:', restoreError);
        } else {
          console.log(`✅ ${agendamentosCancelados.length} agendamentos restaurados`);
        }
      }

      // Atualizar status do bloqueio para inativo
      const { data: bloqueioAtualizado, error: removeError } = await supabase
        .from('bloqueios_agenda')
        .update({ status: 'inativo' })
        .eq('id', bloqueioId)
        .select()
        .single();

      if (removeError) {
        console.log('❌ Erro ao atualizar status do bloqueio:', removeError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Erro ao atualizar bloqueio' 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('✅ Bloqueio removido com sucesso');
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Bloqueio removido e agendamentos restaurados com sucesso',
          data: {
            bloqueio: bloqueioAtualizado,
            agendamentos_restaurados: agendamentosCancelados?.length || 0
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rota para criar bloqueio (ação padrão)
    if (acao === 'create') {
      // Validações básicas para criação
      if (!medicoId || !dataInicio || !dataFim || !motivo) {
        console.log('❌ Dados obrigatórios ausentes para criação');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Todos os campos são obrigatórios para criar bloqueio' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

    console.log('🔍 Verificando médico...');
    
    // Verificar se médico existe
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id, nome')
      .eq('id', medicoId)
      .maybeSingle();

    if (medicoError) {
      console.log('❌ Erro ao verificar médico:', medicoError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao verificar médico' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!medico) {
      console.log('❌ Médico não encontrado');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Médico não encontrado' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Médico encontrado:', medico.nome);

    // Preparar dados para inserção
    const insertData = {
      medico_id: medicoId,
      data_inicio: dataInicio,
      data_fim: dataFim,
      motivo: motivo,
      criado_por: 'recepcionista',
      cliente_id: '2bfb98b5-ae41-4f96-8ba7-acc797c22054' // ID da clínica IPADO
    };
    
    console.log('📝 Inserindo bloqueio:', insertData);

    // Inserir bloqueio
    const { data: bloqueio, error: bloqueioError } = await supabase
      .from('bloqueios_agenda')
      .insert(insertData)
      .select()
      .single();

    if (bloqueioError) {
      console.log('❌ Erro ao criar bloqueio:', bloqueioError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao criar bloqueio',
          details: bloqueioError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Bloqueio criado:', bloqueio.id);

    // 🔥 CANCELAR agendamentos afetados com status cancelado_bloqueio
    console.log('🔍 Buscando e cancelando agendamentos afetados...');
    
    const { data: agendamentos, error: agendamentosError } = await supabase
      .from('agendamentos')
      .select('id, data_agendamento, hora_agendamento')
      .eq('medico_id', medicoId)
      .gte('data_agendamento', dataInicio)
      .lte('data_agendamento', dataFim)
      .eq('status', 'agendado');

    console.log(`📋 Encontrados ${agendamentos?.length || 0} agendamentos para cancelar`);

    // Cancelar agendamentos encontrados
    if (agendamentos && agendamentos.length > 0) {
      const { error: cancelError } = await supabase
        .from('agendamentos')
        .update({ 
          status: 'cancelado_bloqueio',
          cancelado_por: 'Sistema (Bloqueio de Agenda)',
          cancelado_em: new Date().toISOString()
        })
        .in('id', agendamentos.map(a => a.id));

      if (cancelError) {
        console.log('⚠️ Erro ao cancelar agendamentos:', cancelError);
      } else {
        console.log(`✅ ${agendamentos.length} agendamentos cancelados por bloqueio`);
      }
      
      // 🔥 DISPARAR NOTIFICAÇÕES AUTOMÁTICAS
      console.log('📤 Disparando notificações automáticas em background...');
      
      // Chamar edge function de notificação de forma assíncrona
      supabase.functions.invoke('notificar-bloqueio', {
        body: {
          medico_id: medicoId,
          medico_nome: medico.nome,
          data_inicio: dataInicio,
          data_fim: dataFim,
          motivo: motivo,
          agendamentos_afetados: agendamentos.length
        }
      }).then(result => {
        console.log('✅ Notificações disparadas com sucesso:', result);
      }).catch(error => {
        console.error('⚠️ Erro ao disparar notificações (não crítico):', error);
      });
      
      console.log('✅ Processo de notificação iniciado em background');
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
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    }

    // Ação não reconhecida
    console.log('❌ Ação não reconhecida:', acao);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Ação não reconhecida: ${acao}. Use 'create', 'list' ou 'remove'` 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ ERRO GERAL:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Erro interno: ${error?.message || 'Erro desconhecido'}` 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});