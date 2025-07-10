import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 === INICIANDO BLOQUEIO AGENDA ===');
    console.log('📅 Timestamp:', new Date().toISOString());
    console.log('🌐 Método HTTP:', req.method);
    console.log('🔗 URL:', req.url);
    
    // Verificar configuração
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('🔧 Configuração:');
    console.log('  - SUPABASE_URL:', supabaseUrl ? '✅ Configurada' : '❌ Não configurada');
    console.log('  - SERVICE_KEY:', supabaseServiceKey ? '✅ Configurada' : '❌ Não configurada');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ ERRO: Variáveis de ambiente não configuradas');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuração do servidor incompleta',
          details: {
            supabaseUrl: !!supabaseUrl,
            serviceKey: !!supabaseServiceKey
          }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔌 Criando cliente Supabase...');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ Cliente Supabase criado com sucesso');

    const method = req.method;
    console.log('📋 Processando método:', method);

    // Teste simples para verificar se a função está funcionando
    if (method === 'GET' && req.url.includes('?test=true')) {
      console.log('🧪 MODO TESTE ATIVADO');
      
      // Testar conexão com banco
      console.log('🔍 Testando conexão com banco...');
      const { data: testMedicos, error: testError } = await supabase
        .from('medicos')
        .select('id, nome')
        .limit(1);
        
      if (testError) {
        console.error('❌ Erro ao conectar com banco:', testError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Erro de conexão com banco',
            details: testError
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('✅ Conexão com banco OK');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Função funcionando corretamente',
          timestamp: new Date().toISOString(),
          database: 'conectado',
          medicos_sample: testMedicos
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /bloqueio-agenda - Criar bloqueio e notificar pacientes
    if (method === 'POST') {
      const body = await req.json();
      console.log('📝 Dados recebidos para bloqueio:', JSON.stringify(body, null, 2));

      const { 
        medicoId, 
        dataInicio, 
        dataFim, 
        motivo,
        criadoPor = 'recepcionista'
      } = body;

      // Validações básicas
      if (!medicoId || !dataInicio || !dataFim || !motivo) {
        console.error('❌ Dados obrigatórios não fornecidos:', { medicoId, dataInicio, dataFim, motivo });
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Campos obrigatórios: medicoId, dataInicio, dataFim, motivo' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validar formato UUID do médico
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(medicoId)) {
        console.error('❌ Formato de UUID inválido para medicoId:', medicoId);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'ID do médico deve ser um UUID válido' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validar formato das datas
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dataInicio) || !dateRegex.test(dataFim)) {
        console.error('❌ Formato de data inválido:', { dataInicio, dataFim });
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Datas devem estar no formato YYYY-MM-DD' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validar se data início é anterior ou igual à data fim
      if (new Date(dataInicio) > new Date(dataFim)) {
        console.error('❌ Data de início posterior à data de fim:', { dataInicio, dataFim });
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Data de início deve ser anterior ou igual à data de fim' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('🔍 Validando se o médico existe...');
      // Validar se o médico existe - usar maybeSingle() ao invés de single()
      const { data: medico, error: errorMedico } = await supabase
        .from('medicos')
        .select('id, nome')
        .eq('id', medicoId)
        .maybeSingle();

      if (errorMedico) {
        console.error('❌ Erro ao buscar médico:', errorMedico);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Erro ao validar médico: ${errorMedico.message}` 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!medico) {
        console.error('❌ Médico não encontrado:', medicoId);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Médico não encontrado' 
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('✅ Médico validado:', medico.nome);

      // Buscar agendamentos que serão afetados ANTES de criar o bloqueio
      const { data: agendamentosAfetados, error: errorAgendamentos } = await supabase
        .from('agendamentos')
        .select(`
          *,
          pacientes:paciente_id(*),
          medicos:medico_id(*),
          atendimentos:atendimento_id(*)
        `)
        .eq('medico_id', medicoId)
        .gte('data_agendamento', dataInicio)
        .lte('data_agendamento', dataFim)
        .eq('status', 'agendado');

      if (errorAgendamentos) {
        console.error('❌ Erro ao buscar agendamentos:', errorAgendamentos);
        throw errorAgendamentos;
      }

      console.log(`📋 Encontrados ${agendamentosAfetados?.length || 0} agendamentos para cancelar`);

      // SIMPLIFICAÇÃO: Testar inserção básica primeiro
      console.log('🧪 === TESTE DE INSERÇÃO SIMPLIFICADA ===');
      console.log('📋 Dados que serão inseridos:');
      console.log('  - medico_id:', medicoId);
      console.log('  - data_inicio:', dataInicio);
      console.log('  - data_fim:', dataFim);
      console.log('  - motivo:', motivo);
      console.log('  - criado_por:', criadoPor);
      
      // Primeiro, vamos tentar uma inserção super simples sem WhatsApp
      console.log('💾 Tentando inserção básica na tabela bloqueios_agenda...');
      
      try {
        const { data: bloqueio, error: errorBloqueio } = await supabase
          .from('bloqueios_agenda')
          .insert({
            medico_id: medicoId,
            data_inicio: dataInicio,
            data_fim: dataFim,
            motivo: motivo,
            criado_por: criadoPor,
          })
          .select()
          .single();

        if (errorBloqueio) {
          console.error('❌ ERRO ESPECÍFICO NA INSERÇÃO:', {
            message: errorBloqueio.message,
            details: errorBloqueio.details,
            hint: errorBloqueio.hint,
            code: errorBloqueio.code
          });
          
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Erro detalhado na inserção: ${errorBloqueio.message}`,
              errorDetails: {
                message: errorBloqueio.message,
                details: errorBloqueio.details,
                hint: errorBloqueio.hint,
                code: errorBloqueio.code
              }
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('✅ SUCESSO! Bloqueio criado:', {
          id: bloqueio?.id,
          medico_id: bloqueio?.medico_id,
          created_at: bloqueio?.created_at
        });
        
        // Por enquanto, retornar sucesso SEM fazer WhatsApp para isolar o problema
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Bloqueio criado com sucesso (modo simplificado)',
            data: {
              bloqueio,
              agendamentos_cancelados: agendamentosAfetados?.length || 0,
              nota: 'WhatsApp desabilitado para teste'
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      } catch (insertError) {
        console.error('❌ ERRO INESPERADO NA INSERÇÃO:', insertError);
        console.error('Stack trace:', insertError.stack);
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Erro inesperado: ${insertError.message}`,
            stack: insertError.stack
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Enviar notificações WhatsApp para os pacientes afetados
      const notificacoes = [];
      
      for (const agendamento of agendamentosAfetados || []) {
        try {
          const paciente = agendamento.pacientes;
          const medico = agendamento.medicos;
          const atendimento = agendamento.atendimentos;
          
          if (paciente?.celular) {
            const mensagem = montarMensagemCancelamento({
              paciente: paciente.nome_completo,
              medico: medico.nome,
              atendimento: atendimento.nome,
              data: new Date(agendamento.data_agendamento).toLocaleDateString('pt-BR'),
              hora: agendamento.hora_agendamento,
              motivo: motivo
            });

            // Enviar WhatsApp via Evolution API
            const resultWhatsApp = await enviarWhatsAppEvolution(paciente.celular, mensagem);
            
            notificacoes.push({
              agendamento_id: agendamento.id,
              paciente: paciente.nome_completo,
              celular: paciente.celular,
              status: 'enviado',
              resultado: resultWhatsApp
            });

            console.log(`✅ WhatsApp enviado para ${paciente.nome_completo}`);
          } else {
            notificacoes.push({
              agendamento_id: agendamento.id,
              paciente: paciente?.nome_completo || 'Desconhecido',
              celular: 'sem_celular',
              status: 'erro',
              erro: 'Paciente sem celular cadastrado'
            });
            
            console.log(`⚠️ Paciente ${paciente?.nome_completo} sem celular`);
          }
        } catch (error) {
          console.error(`❌ Erro ao notificar paciente:`, error);
          notificacoes.push({
            agendamento_id: agendamento.id,
            paciente: agendamento.pacientes?.nome_completo || 'Desconhecido',
            status: 'erro',
            erro: error.message
          });
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: {
            bloqueio,
            agendamentos_cancelados: agendamentosAfetados?.length || 0,
            notificacoes
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /bloqueio-agenda - Listar bloqueios
    if (method === 'GET') {
      const { data: bloqueios, error } = await supabase
        .from('bloqueios_agenda')
        .select(`
          *,
          medicos:medico_id(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: bloqueios }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na API:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})

// Função para enviar WhatsApp via Evolution API
async function enviarWhatsAppEvolution(celular: string, mensagem: string) {
  try {
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL') || 'https://evolutionapi.inovaia.online';
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || 'grozNCsxwy32iYir20LRw7dfIRNPI8UZ';
    const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'Endogastro';

    console.log(`📱 Enviando WhatsApp via Evolution API para: ${celular}`);

    const response = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        number: celular,
        text: mensagem
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro ao enviar WhatsApp: ${response.status} - ${errorText}`);
      throw new Error(`Evolution API error: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ WhatsApp enviado com sucesso:', result);
    return result;
  } catch (error) {
    console.error('❌ Erro na integração Evolution API:', error);
    throw error;
  }
}

// Função para montar mensagem de cancelamento
function montarMensagemCancelamento(dados: {
  paciente: string;
  medico: string;
  atendimento: string;
  data: string;
  hora: string;
  motivo: string;
}): string {
  return `🏥 *AGENDAMENTO CANCELADO - ENDOGASTRO*

Olá ${dados.paciente}!

⚠️ *IMPORTANTE:* Precisamos cancelar seu agendamento:

📅 *Data:* ${dados.data}
⏰ *Horário:* ${dados.hora}
👨‍⚕️ *Médico:* ${dados.medico}
🔬 *Exame:* ${dados.atendimento}

📋 *Motivo:* ${dados.motivo}

💬 *O que fazer agora?*
Entre em contato conosco para reagendar:
📞 *Telefone:* (XX) XXXX-XXXX
📱 *WhatsApp:* Este mesmo número

🙏 Pedimos desculpas pelo transtorno e contamos com sua compreensão.

🏥 *ENDOGASTRO - Clínica de Gastroenterologia*`;
}