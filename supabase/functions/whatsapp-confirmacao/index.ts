import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para enviar WhatsApp via Evolution API
async function enviarWhatsAppEvolution(celular: string, mensagem: string) {
  try {
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL') || 'https://evolutionapi.inovaia.online';
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || 'grozNCsxwy32iYir20LRw7dfIRNPI8UZ';
    const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'Endogastro';

    console.log(`📱 Enviando WhatsApp de confirmação para: ${celular}`);

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
    console.log('✅ WhatsApp de confirmação enviado com sucesso:', result);
    return result;
  } catch (error) {
    console.error('❌ Erro na integração Evolution API:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔔 WhatsApp Confirmação API chamada');

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const body = await req.json();
    console.log('📨 Dados recebidos:', body);

    const {
      agendamento_id,
      paciente_nome,
      paciente_celular,
      medico_nome,
      atendimento_nome,
      data_agendamento,
      hora_agendamento,
      observacoes
    } = body;

    // Validar dados obrigatórios
    if (!agendamento_id || !paciente_nome || !paciente_celular || !medico_nome || !atendimento_nome) {
      console.error('❌ Dados obrigatórios faltando');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Dados obrigatórios faltando' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Formatar a data e hora
    const dataFormatada = new Date(data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR');
    const horaFormatada = hora_agendamento.substring(0, 5);

    // Criar mensagem de confirmação
    const mensagem = `🏥 *ENDOGASTRO - Confirmação de Agendamento*

Olá, ${paciente_nome}! 

✅ Seu agendamento foi confirmado:

📅 **Data:** ${dataFormatada}
⏰ **Horário:** ${horaFormatada}
👨‍⚕️ **Médico:** Dr(a). ${medico_nome}
🔬 **Procedimento:** ${atendimento_nome}

${observacoes ? `📝 **Observações:** ${observacoes}` : ''}

📍 **Endereço:** [Inserir endereço da clínica]

⚠️ **IMPORTANTE:**
• Chegue 15 minutos antes do horário
• Traga documentos e cartão do convênio
• Em caso de dúvidas, entre em contato

Para cancelar ou remarcar, responda esta mensagem ou ligue para nossa central.

_Mensagem automática - Endogastro_`;

    try {
      // Enviar WhatsApp
      await enviarWhatsAppEvolution(paciente_celular, mensagem);

      // Registrar log de sucesso
      await supabase.from('notification_logs').insert({
        agendamento_id: agendamento_id,
        type: 'confirmacao',
        recipient: paciente_celular,
        message: mensagem,
        status: 'sent',
        sent_at: new Date().toISOString(),
        is_for_staff: false
      });

      console.log('✅ Confirmação enviada e registrada com sucesso');

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Confirmação WhatsApp enviada com sucesso' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } catch (whatsappError) {
      console.error('❌ Erro ao enviar WhatsApp:', whatsappError);

      // Registrar log de erro
      await supabase.from('notification_logs').insert({
        agendamento_id: agendamento_id,
        type: 'confirmacao',
        recipient: paciente_celular,
        message: mensagem,
        status: 'error',
        error_message: whatsappError.message,
        is_for_staff: false
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao enviar WhatsApp: ' + whatsappError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('❌ Erro geral na API:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})