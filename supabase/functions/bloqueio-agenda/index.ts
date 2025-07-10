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
    console.log('🔧 Verificando configuração...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('URL configurada:', supabaseUrl ? 'Sim' : 'Não');
    console.log('Service Key configurada:', supabaseServiceKey ? 'Sim' : 'Não');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Variáveis de ambiente não configuradas');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuração do servidor incompleta' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔌 Criando cliente Supabase com Service Role Key...');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const method = req.method;

    // POST /bloqueio-agenda - Criar bloqueio e notificar pacientes
    if (method === 'POST') {
      const body = await req.json();
      console.log('📝 Dados recebidos para bloqueio:', body);

      const { 
        medicoId, 
        dataInicio, 
        dataFim, 
        motivo,
        criadoPor = 'recepcionista'
      } = body;

      // Validações
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

      // Validar se o médico existe
      const { data: medico, error: errorMedico } = await supabase
        .from('medicos')
        .select('id, nome')
        .eq('id', medicoId)
        .single();

      if (errorMedico || !medico) {
        console.error('❌ Médico não encontrado:', medicoId, errorMedico);
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

      // Criar o bloqueio de agenda
      console.log('💾 Criando bloqueio na base de dados...');
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
        console.error('❌ Erro ao criar bloqueio:', errorBloqueio);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Erro ao criar bloqueio: ${errorBloqueio.message}` 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('✅ Bloqueio criado:', bloqueio.id);

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