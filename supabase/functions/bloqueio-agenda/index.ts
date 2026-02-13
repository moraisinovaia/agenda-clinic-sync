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

  // --- JWT Validation ---
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ success: false, error: 'Não autorizado' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  const jwtClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );
  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsError } = await jwtClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    console.error('❌ JWT inválido:', claimsError?.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Token inválido' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  console.log('✅ JWT validado, user:', claimsData.claims.sub);
  // --- End JWT Validation ---

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
    
    // Verificar se médico existe e obter cliente_id
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id, nome, cliente_id')
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

    // Usar cliente_id do body, ou do médico, ou fallback para IPADO
    const IPADO_FALLBACK_ID = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';
    const clienteIdFinal = body.cliente_id || medico.cliente_id || IPADO_FALLBACK_ID;
    
    console.log(`🏥 Cliente ID: ${clienteIdFinal} (fonte: ${body.cliente_id ? 'body' : medico.cliente_id ? 'médico' : 'fallback IPADO'})`);
    
    // Preparar dados para inserção
    const insertData = {
      medico_id: medicoId,
      data_inicio: dataInicio,
      data_fim: dataFim,
      motivo: motivo,
      criado_por: 'recepcionista',
      cliente_id: clienteIdFinal
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
      
      // Lista de médicos que disparam webhook N8N
      const MEDICOS_COM_WEBHOOK_N8N = [
        '32d30887-b876-4502-bf04-e55d7fb55b50', // Dra. Adriana Carla de Sena
        '1e110923-50df-46ff-a57a-29d88e372900', // Dr. Marcelo D'Carli
        'c192e08e-e216-4c22-99bf-b5992ce05e17', // Dr. Alessandro Dias
        '66e9310d-34cd-4005-8937-74e87125dc03'  // Dr. Pedro Francisco
      ];

      // Verificar se este médico deve disparar webhook
      const deveDispararWebhook = MEDICOS_COM_WEBHOOK_N8N.includes(medicoId);

      if (deveDispararWebhook && agendamentos.length > 0) {
        // 🔥 DISPARAR WEBHOOK N8N PARA REAGENDAMENTO
        console.log('📤 Enviando dados para N8N via webhook...');
        
        // Buscar dados completos dos pacientes afetados
        const { data: agendamentosCompletos, error: agendamentosCompletosError } = await supabase
        .from('agendamentos')
        .select(`
          id,
          data_agendamento,
          hora_agendamento,
          convenio,
          pacientes!inner(
            id,
            nome_completo,
            celular,
            telefone
          ),
          atendimentos!inner(
            id,
            nome,
            tipo
          )
        `)
        .in('id', agendamentos.map(a => a.id));

      if (agendamentosCompletosError) {
        console.error('⚠️ Erro ao buscar dados completos:', agendamentosCompletosError);
      }

      // Formatar data para exibição (DD/MM/YYYY)
      const formatDateForDisplay = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      };

      // Formatar dados para N8N
      const webhookPayload = {
        tipo_evento: 'bloqueio_agenda',
        timestamp: new Date().toISOString(),
        medico: {
          id: medicoId,
          nome: medico.nome,
          especialidade: 'Endoscopia'
        },
        bloqueio: {
          id: bloqueio.id,
          data_inicio: dataInicio,
          data_fim: dataFim,
          motivo: motivo,
          criado_por: 'recepcionista',
          criado_em: new Date().toISOString()
        },
        pacientes_afetados: (agendamentosCompletos || []).map(ag => ({
          agendamento_id: ag.id,
          paciente_id: ag.pacientes.id,
          paciente_nome: ag.pacientes.nome_completo,
          paciente_celular: ag.pacientes.celular || '',
          paciente_telefone: ag.pacientes.telefone || '',
          data_agendamento_original: ag.data_agendamento,
          hora_agendamento_original: ag.hora_agendamento,
          data_hora_formatada: `${formatDateForDisplay(ag.data_agendamento)} às ${ag.hora_agendamento.substring(0, 5)}`,
          atendimento: {
            id: ag.atendimentos.id,
            nome: ag.atendimentos.nome,
            tipo: ag.atendimentos.tipo
          },
          convenio: ag.convenio
        })),
        total_pacientes_afetados: agendamentos.length,
        url_sistema: 'https://endogastro.lovable.app',
        cliente_id: clienteIdFinal
      };

      console.log('📦 Payload preparado:', JSON.stringify(webhookPayload, null, 2));

      // Enviar webhook para N8N
      const webhookUrl = 'https://n8n.inovaia.online/webhook/remarcar';
      
      try {
        console.log('🌐 Enviando para webhook N8N:', webhookUrl);
        
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload)
        });

        if (webhookResponse.ok) {
          const responseData = await webhookResponse.text();
          console.log('✅ Webhook N8N disparado com sucesso:', responseData);
          
          // Log de sucesso
          await supabase.from('system_logs').insert({
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `Webhook N8N disparado para bloqueio: ${agendamentos.length} pacientes`,
            context: 'BLOQUEIO_WEBHOOK_N8N',
            data: {
              bloqueio_id: bloqueio.id,
              medico: medico.nome,
              total_pacientes: agendamentos.length,
              webhook_url: webhookUrl
            }
          });
        } else {
          const errorText = await webhookResponse.text();
          console.error('⚠️ Erro no webhook N8N:', webhookResponse.status, errorText);
          
          // Log de erro
          await supabase.from('system_logs').insert({
            timestamp: new Date().toISOString(),
            level: 'error',
            message: `Erro ao disparar webhook N8N: ${webhookResponse.status}`,
            context: 'BLOQUEIO_WEBHOOK_N8N_ERROR',
            data: {
              status: webhookResponse.status,
              error: errorText,
              bloqueio_id: bloqueio.id,
              webhook_url: webhookUrl
            }
          });
        }
      } catch (error: any) {
        console.error('❌ Erro ao chamar webhook N8N:', error.message);
        
        // Log de erro crítico
        await supabase.from('system_logs').insert({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `Falha crítica no webhook N8N: ${error.message}`,
          context: 'BLOQUEIO_WEBHOOK_N8N_CRITICAL',
          data: {
            error: error.message,
            bloqueio_id: bloqueio.id,
            webhook_url: webhookUrl
          }
        });
      }
      
      console.log('✅ Processo de webhook N8N concluído');
      } else {
        // Webhook não será disparado
        const motivo = !deveDispararWebhook 
          ? 'Médico não configurado para webhook N8N'
          : 'Sem agendamentos afetados';
        
        console.log(`ℹ️ Webhook N8N não será disparado: ${motivo}`);
        
        await supabase.from('system_logs').insert({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Bloqueio criado sem webhook N8N: ${medico.nome}`,
          context: 'BLOQUEIO_SEM_WEBHOOK',
          data: {
            bloqueio_id: bloqueio.id,
            medico_id: medicoId,
            medico_nome: medico.nome,
            motivo: motivo,
            agendamentos_afetados: agendamentos.length
          }
        });
      }
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