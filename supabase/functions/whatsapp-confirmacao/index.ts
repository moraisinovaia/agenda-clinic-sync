import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para enviar WhatsApp via Evolution API com retry automático
async function enviarWhatsAppEvolution(celular: string, mensagem: string, retryCount: number = 0): Promise<any> {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 segundo
  
  try {
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY');
    const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

    // Validações detalhadas de configuração
    if (!evolutionUrl) {
      throw new Error('EVOLUTION_API_URL não configurada nos secrets do Supabase');
    }
    if (!apiKey) {
      throw new Error('EVOLUTION_API_KEY não configurada nos secrets do Supabase');  
    }
    if (!instanceName) {
      throw new Error('EVOLUTION_INSTANCE_NAME não configurada nos secrets do Supabase');
    }

    console.log(`📱 [Tentativa ${retryCount + 1}/${maxRetries + 1}] Enviando WhatsApp para: ${celular}`);
    console.log(`🔗 URL da API: ${evolutionUrl}/message/sendText/${instanceName}`);

    // Limpar e formatar número
    const numeroLimpo = celular.replace(/\D/g, '');
    
    if (numeroLimpo.length < 10) {
      throw new Error(`Número de telefone inválido: ${celular} (muito curto)`);
    }
    
    // Adicionar código do país se não tiver
    const numeroCompleto = numeroLimpo.startsWith('55') ? numeroLimpo : `55${numeroLimpo}`;
    
    console.log(`📞 Número formatado: ${numeroCompleto}`);

    const requestBody = {
      number: numeroCompleto,
      text: mensagem
    };

    const response = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        'User-Agent': 'Supabase-Edge-Function'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(15000) // 15 segundos timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorMsg = `Evolution API HTTP ${response.status}: ${errorText}`;
      console.error(`❌ Erro HTTP da Evolution API: ${errorMsg}`);
      
      // Se erro 4xx, não retry (erro de cliente)
      if (response.status >= 400 && response.status < 500 && retryCount === 0) {
        throw new Error(`Erro de cliente (não será reprocessado): ${errorMsg}`);
      }
      
      throw new Error(errorMsg);
    }

    const result = await response.json();
    console.log('✅ WhatsApp enviado com sucesso:', JSON.stringify(result, null, 2));
    
    return result;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`❌ [Tentativa ${retryCount + 1}] Erro na Evolution API:`, errorMessage);
    
    // Implementar retry exponencial para erros de rede/temporários
    if (retryCount < maxRetries && !errorMessage.includes('não será reprocessado') && !errorMessage.includes('inválido')) {
      const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
      console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return enviarWhatsAppEvolution(celular, mensagem, retryCount + 1);
    }
    
    throw error;
  }
}

Deno.serve(async (req) => {
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
      celular,
      medico_nome,
      atendimento_nome,
      atendimento_id,
      data_agendamento,
      hora_agendamento,
      observacoes,
      convenio
    } = body;

    // Usar o celular do campo correto
    const numeroCelular = paciente_celular || celular;

    // Validar dados obrigatórios
    if (!agendamento_id || !paciente_nome || !numeroCelular) {
      console.error('❌ Dados obrigatórios faltando');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Dados obrigatórios faltando: agendamento_id, paciente_nome e celular são obrigatórios' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Buscar preparos para este tipo de atendimento
    let preparos = null;
    try {
      const { data: preparosData, error: preparosError } = await supabase
        .from('preparos')
        .select('*')
        .ilike('exame', `%${atendimento_nome.replace(/[^\w\s]/gi, '')}%`)
        .limit(1);
      
      if (preparosError) {
        console.log('⚠️ Erro ao buscar preparos:', preparosError);
      } else if (preparosData && preparosData.length > 0) {
        preparos = preparosData[0];
        console.log('✅ Preparos encontrados:', preparos.nome);
      } else {
        console.log('ℹ️ Nenhum preparo encontrado para:', atendimento_nome);
      }
    } catch (error) {
      console.log('⚠️ Erro na busca de preparos:', error);
    }

    // Formatar a data e hora
    const dataFormatada = new Date(data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR');
    const horaFormatada = hora_agendamento.substring(0, 5);

    // Formatar mensagem com preparos (se existirem)
    let mensagemPreparos = '';
    if (preparos) {
      mensagemPreparos = `\n\n🔬 **INSTRUÇÕES DE PREPARO PARA ${atendimento_nome.toUpperCase()}:**\n`;
      
      if (preparos.jejum_horas) {
        mensagemPreparos += `\n⏰ **Jejum:** ${preparos.jejum_horas} horas antes do exame`;
      }
      
      if (preparos.medicacao_suspender) {
        mensagemPreparos += `\n💊 **Medicações a suspender:** ${preparos.medicacao_suspender}`;
        if (preparos.dias_suspensao) {
          mensagemPreparos += ` (${preparos.dias_suspensao} dias antes)`;
        }
      }
      
      if (preparos.restricoes_alimentares) {
        mensagemPreparos += `\n🍽️ **Restrições alimentares:** ${preparos.restricoes_alimentares}`;
      }
      
      if (preparos.itens_levar) {
        mensagemPreparos += `\n📋 **Documentos a trazer:** ${preparos.itens_levar}`;
      }
      
      if (preparos.observacoes_especiais) {
        mensagemPreparos += `\n⚠️ **Observações especiais:** ${preparos.observacoes_especiais}`;
      }
      
      // Instruções detalhadas se existirem
      if (preparos.instrucoes && Array.isArray(preparos.instrucoes)) {
        mensagemPreparos += `\n\n📝 **Instruções detalhadas:**`;
        preparos.instrucoes.forEach((instrucao, index) => {
          mensagemPreparos += `\n${index + 1}. ${instrucao.instrucao}`;
        });
      }
      
      mensagemPreparos += `\n\n⚠️ **IMPORTANTE:** O não cumprimento das instruções pode resultar no cancelamento do exame.`;
    }

    // Criar mensagem de confirmação
    const mensagem = `🏥 *ENDOGASTRO - Confirmação de Agendamento*

Olá, ${paciente_nome}! 

✅ Seu agendamento foi confirmado:

📅 **Data:** ${dataFormatada}
⏰ **Horário:** ${horaFormatada}
👨‍⚕️ **Médico:** Dr(a). ${medico_nome}
🔬 **Procedimento:** ${atendimento_nome}

${observacoes ? `📝 **Observações:** ${observacoes}` : ''}${mensagemPreparos}

📍 **Endereço:** Rua da Clínica, 123 - Centro
📞 **Contato:** (11) 1234-5678

⚠️ **LEMBRETE GERAL:**
• Chegue 15 minutos antes do horário
• Traga documentos e cartão do convênio
• Em caso de dúvidas, entre em contato

Para cancelar ou remarcar, responda esta mensagem ou ligue para nossa central.

_Mensagem automática - Endogastro_`;

    try {
      // Enviar WhatsApp
      await enviarWhatsAppEvolution(numeroCelular, mensagem);

      // Registrar log de sucesso
      await supabase.from('notification_logs').insert({
        agendamento_id: agendamento_id,
        type: 'confirmacao',
        recipient: numeroCelular,
        message: mensagem,
        status: 'sent',
        sent_at: new Date().toISOString(),
        is_for_staff: false
      });

      console.log('✅ Confirmação enviada e registrada com sucesso');

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Confirmação WhatsApp enviada com sucesso',
          recipient: numeroCelular,
          agendamento_id
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
        recipient: numeroCelular,
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