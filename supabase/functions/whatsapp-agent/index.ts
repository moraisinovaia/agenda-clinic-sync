import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WhatsAppMessage {
  from: string;
  body: string;
  fromName?: string;
  timestamp?: number;
}

interface AgentResponse {
  message: string;
  actions?: string[];
}

// Função para enviar WhatsApp via Evolution API
async function enviarWhatsApp(celular: string, mensagem: string) {
  try {
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL') || 'https://evolutionapi.inovaia.online';
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || 'grozNCsxwy32iYir20LRw7dfIRNPI8UZ';
    const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'Endogastro';

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
      throw new Error(`Evolution API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Erro ao enviar WhatsApp:', error);
    throw error;
  }
}

// Função principal do agente
async function processarMensagem(supabase: any, message: WhatsAppMessage): Promise<AgentResponse> {
  const texto = message.body.toLowerCase().trim();
  const celular = message.from;

  console.log(`🤖 Processando mensagem de ${celular}: "${texto}"`);

  // Comandos disponíveis
  if (texto.includes('ajuda') || texto.includes('help') || texto === '/help') {
    return {
      message: `🏥 *Central de Atendimento Endogastro*

📋 Comandos disponíveis:
• *horarios* - Ver horários disponíveis
• *medicos* - Lista de médicos
• *agendar* - Solicitar agendamento
• *cancelar* - Cancelar agendamento
• *fila* - Entrar na fila de espera
• *preparos* - Ver preparos para exames
• *ajuda* - Ver esta lista

Digite um comando para começar! 😊`
    };
  }

  // Horários disponíveis
  if (texto.includes('horarios') || texto.includes('disponível') || texto.includes('disponivel')) {
    try {
      const { data: medicos } = await supabase
        .from('medicos')
        .select('nome, especialidade, horarios')
        .eq('ativo', true);

      let resposta = '⏰ *Horários Disponíveis*\n\n';
      
      for (const medico of medicos || []) {
        resposta += `👨‍⚕️ *${medico.nome}*\n`;
        resposta += `📍 ${medico.especialidade}\n`;
        
        if (medico.horarios) {
          const horarios = typeof medico.horarios === 'string' ? 
            JSON.parse(medico.horarios) : medico.horarios;
          
          Object.entries(horarios).forEach(([dia, horario]: [string, any]) => {
            if (horario && horario.length > 0) {
              resposta += `• ${dia}: ${horario.join(', ')}\n`;
            }
          });
        }
        resposta += '\n';
      }
      
      resposta += 'Para agendar, digite: *agendar*';
      
      return { message: resposta };
    } catch (error) {
      return { message: '❌ Erro ao consultar horários. Tente novamente.' };
    }
  }

  // Lista de médicos
  if (texto.includes('medicos') || texto.includes('médicos') || texto.includes('doutor')) {
    try {
      const { data: medicos } = await supabase
        .from('medicos')
        .select('nome, especialidade, idade_minima, idade_maxima, convenios_aceitos')
        .eq('ativo', true);

      let resposta = '👨‍⚕️ *Nossos Médicos*\n\n';
      
      for (const medico of medicos || []) {
        resposta += `🩺 *${medico.nome}*\n`;
        resposta += `📍 ${medico.especialidade}\n`;
        
        if (medico.idade_minima || medico.idade_maxima) {
          resposta += `👥 Idades: ${medico.idade_minima || '0'} - ${medico.idade_maxima || '∞'} anos\n`;
        }
        
        if (medico.convenios_aceitos && medico.convenios_aceitos.length > 0) {
          resposta += `🏥 Convênios: ${medico.convenios_aceitos.join(', ')}\n`;
        }
        resposta += '\n';
      }
      
      resposta += 'Para agendar consulta, digite: *agendar*';
      
      return { message: resposta };
    } catch (error) {
      return { message: '❌ Erro ao consultar médicos. Tente novamente.' };
    }
  }

  // Agendar consulta
  if (texto.includes('agendar') || texto.includes('consulta') || texto.includes('marcar')) {
    return {
      message: `📅 *Agendamento de Consulta*

Para agendar sua consulta, preciso das seguintes informações:

📝 *Nome completo*
📅 *Data de nascimento*
🏥 *Convênio*
📞 *Telefone*
👨‍⚕️ *Médico de preferência*
📆 *Data preferida*

Por favor, entre em contato com nossa recepção:
📞 (XX) XXXX-XXXX

Ou acesse nosso sistema online para agendamento automático! 💻

Digite *fila* para entrar na fila de espera de cancelamentos.`
    };
  }

  // Fila de espera
  if (texto.includes('fila') || texto.includes('cancelamento') || texto.includes('vaga')) {
    return {
      message: `📋 *Fila de Espera*

Entre na fila de espera para ser notificado quando houver cancelamentos!

✅ *Como funciona:*
• Você entra na fila para o médico/data desejada
• Quando alguém cancela, você é notificado primeiro
• Tem 2 horas para confirmar o agendamento

📞 Para entrar na fila, ligue:
**(XX) XXXX-XXXX**

⏰ Horário de atendimento:
• Segunda a Sexta: 7h às 18h
• Sábado: 7h às 12h`
    };
  }

  // Preparos para exames
  if (texto.includes('preparo') || texto.includes('exame') || texto.includes('jejum')) {
    try {
      const { data: preparos } = await supabase
        .from('preparos')
        .select('nome, exame, jejum_horas, restricoes_alimentares, medicacao_suspender')
        .limit(5);

      let resposta = '🔬 *Preparos para Exames*\n\n';
      
      for (const preparo of preparos || []) {
        resposta += `📋 *${preparo.nome}*\n`;
        resposta += `🔍 Exame: ${preparo.exame}\n`;
        
        if (preparo.jejum_horas) {
          resposta += `⏰ Jejum: ${preparo.jejum_horas}h\n`;
        }
        
        if (preparo.restricoes_alimentares) {
          resposta += `🚫 Restrições: ${preparo.restricoes_alimentares}\n`;
        }
        
        if (preparo.medicacao_suspender) {
          resposta += `💊 Suspender: ${preparo.medicacao_suspender}\n`;
        }
        resposta += '\n';
      }
      
      resposta += 'Para informações específicas, consulte nossa equipe! 📞';
      
      return { message: resposta };
    } catch (error) {
      return { message: '❌ Erro ao consultar preparos. Tente novamente.' };
    }
  }

  // Cancelar agendamento
  if (texto.includes('cancelar') || texto.includes('desmarcar')) {
    return {
      message: `❌ *Cancelamento de Consulta*

Para cancelar sua consulta:

📞 Ligue: **(XX) XXXX-XXXX**
📱 WhatsApp: **(XX) XXXX-XXXX**

⚠️ *Importante:*
• Cancele com pelo menos 24h de antecedência
• Evite multas e taxas
• Permita que outros pacientes usem o horário

⏰ Horário de atendimento:
• Segunda a Sexta: 7h às 18h
• Sábado: 7h às 12h

*Obrigado pela compreensão!* 🙏`
    };
  }

  // Resposta padrão
  return {
    message: `🤖 Olá! Sou o assistente virtual da *Endogastro*.

Não entendi sua solicitação. Digite *ajuda* para ver os comandos disponíveis.

🏥 *Central de Atendimento:*
📞 (XX) XXXX-XXXX
📱 WhatsApp: Este número
⏰ Seg-Sex: 7h às 18h | Sáb: 7h às 12h

Como posso te ajudar hoje? 😊`
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Parse incoming webhook data
    const webhookData = await req.json();
    console.log('📨 Webhook recebido:', JSON.stringify(webhookData, null, 2));

    // Extrair dados da mensagem (formato pode variar dependendo da Evolution API)
    const message: WhatsAppMessage = {
      from: webhookData.data?.key?.remoteJid || webhookData.from || '',
      body: webhookData.data?.message?.conversation || 
            webhookData.data?.message?.extendedTextMessage?.text ||
            webhookData.body || '',
      fromName: webhookData.data?.pushName || webhookData.fromName || '',
      timestamp: webhookData.data?.messageTimestamp || Date.now()
    };

    // Validar se é uma mensagem válida
    if (!message.from || !message.body) {
      console.log('❌ Mensagem inválida ou vazia');
      return new Response(
        JSON.stringify({ success: false, error: 'Mensagem inválida' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ignorar mensagens do próprio bot ou grupos
    if (message.from.includes('@g.us') || message.from.includes('status@broadcast')) {
      console.log('📝 Ignorando mensagem de grupo ou status');
      return new Response(
        JSON.stringify({ success: true, message: 'Mensagem ignorada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Processar mensagem com o agente
    const resposta = await processarMensagem(supabase, message);
    
    // Enviar resposta via WhatsApp
    await enviarWhatsApp(message.from, resposta.message);
    
    // Log para auditoria
    await supabase.from('system_logs').insert({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'WhatsApp Agent: Mensagem processada',
      context: 'WHATSAPP_AGENT',
      data: {
        from: message.from,
        fromName: message.fromName,
        body: message.body,
        response: resposta.message
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mensagem processada e resposta enviada',
        response: resposta 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro no WhatsApp Agent:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});