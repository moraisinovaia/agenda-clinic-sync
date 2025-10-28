import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DELAY_ENTRE_MENSAGENS = 2000; // 2 segundos para não sobrecarregar Evolution API

// Função para formatar celular no padrão internacional brasileiro
function formatarCelular(celular: string): string | null {
  if (!celular) return null;
  
  // Remove todos os caracteres não numéricos
  const numero = celular.replace(/\D/g, '');
  
  // Valida formato brasileiro (11 dígitos: DDD + 9 dígitos)
  if (numero.length !== 11) {
    console.warn(`⚠️ Celular inválido (${numero.length} dígitos): ${celular}`);
    return null;
  }
  
  // Valida DDD (deve estar entre 11 e 99)
  const ddd = parseInt(numero.substring(0, 2));
  if (ddd < 11 || ddd > 99) {
    console.warn(`⚠️ DDD inválido: ${ddd}`);
    return null;
  }
  
  // Retorna no formato internacional: 55 + DDD + número
  return `55${numero}`;
}

// Função para formatar data no padrão brasileiro
function formatarData(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

// Função para formatar hora removendo segundos
function formatarHora(hora: string): string {
  return hora.substring(0, 5); // "08:00:00" -> "08:00"
}

// Função para criar mensagem de bloqueio COM próximas datas
function criarMensagemComDatas(params: {
  pacienteNome: string;
  medicoNome: string;
  dataOriginal: string;
  horaOriginal: string;
  motivo: string;
  proximasDatas: Array<{data: string; dia_semana: string; horarios: string[]}>;
}): string {
  const { pacienteNome, medicoNome, dataOriginal, horaOriginal, motivo, proximasDatas } = params;
  
  let mensagem = `🚨 IMPORTANTE: Reagendamento Necessário\n\n`;
  mensagem += `Olá, ${pacienteNome}!\n\n`;
  mensagem += `Sua consulta com ${medicoNome} no dia ${formatarData(dataOriginal)} às ${formatarHora(horaOriginal)}h foi cancelada.\n\n`;
  mensagem += `📋 Motivo: ${motivo}\n\n`;
  mensagem += `✅ PRÓXIMAS DATAS DISPONÍVEIS:\n\n`;
  
  proximasDatas.slice(0, 3).forEach((disponibilidade) => {
    mensagem += `📅 ${formatarData(disponibilidade.data)} - ${disponibilidade.dia_semana}\n`;
    mensagem += `🕐 ${disponibilidade.horarios.slice(0, 3).join(' | ')}\n\n`;
  });
  
  mensagem += `Para reagendar, responda este WhatsApp ou ligue:\n`;
  mensagem += `📞 (19) 3442-8053\n\n`;
  mensagem += `Clínica INOVAIA - IPADO`;
  
  return mensagem;
}

// Função para criar mensagem de bloqueio SEM próximas datas (fallback)
function criarMensagemSemDatas(params: {
  pacienteNome: string;
  medicoNome: string;
  dataOriginal: string;
  horaOriginal: string;
  motivo: string;
}): string {
  const { pacienteNome, medicoNome, dataOriginal, horaOriginal, motivo } = params;
  
  let mensagem = `🚨 IMPORTANTE: Reagendamento Necessário\n\n`;
  mensagem += `Olá, ${pacienteNome}!\n\n`;
  mensagem += `Sua consulta com ${medicoNome} no dia ${formatarData(dataOriginal)} às ${formatarHora(horaOriginal)}h foi cancelada.\n\n`;
  mensagem += `📋 Motivo: ${motivo}\n\n`;
  mensagem += `⚠️ No momento não há vagas disponíveis na agenda online.\n\n`;
  mensagem += `Por favor, entre em contato para reagendar:\n`;
  mensagem += `📞 (19) 3442-8053\n\n`;
  mensagem += `Clínica INOVAIA - IPADO`;
  
  return mensagem;
}

// Função para enviar WhatsApp via Evolution API
async function enviarWhatsApp(celular: string, mensagem: string) {
  const evolutionUrl = Deno.env.get('EVOLUTION_API_URL') || 'https://evolutionapi.inovaia.online';
  const apiKey = Deno.env.get('EVOLUTION_API_KEY') || 'grozNCsxwy32iYir20LRw7dfIRNPI8UZ';
  const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'Endogastro';
  
  console.log(`📱 Enviando WhatsApp para: ${celular}`);
  
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
    throw new Error(`Evolution API error ${response.status}: ${errorText}`);
  }
  
  return await response.json();
}

serve(async (req) => {
  console.log('🚀 NOTIFICAR BLOQUEIO - Iniciando');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Configuração Supabase incompleta');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Receber dados do bloqueio
    const { 
      medico_id, 
      medico_nome, 
      data_inicio, 
      data_fim, 
      motivo,
      agendamentos_afetados 
    } = await req.json();
    
    console.log(`📋 Bloqueio criado: ${medico_nome} (${data_inicio} a ${data_fim})`);
    console.log(`👥 Agendamentos afetados: ${agendamentos_afetados}`);
    
    // Buscar agendamentos cancelados por este bloqueio com dados dos pacientes
    const { data: agendamentos, error: agendamentosError } = await supabase
      .from('agendamentos')
      .select(`
        id,
        data_agendamento,
        hora_agendamento,
        atendimento_id,
        pacientes!inner(
          id,
          nome_completo,
          celular,
          telefone
        ),
        atendimentos!inner(
          id,
          nome
        )
      `)
      .eq('medico_id', medico_id)
      .gte('data_agendamento', data_inicio)
      .lte('data_agendamento', data_fim)
      .eq('status', 'cancelado_bloqueio');
    
    if (agendamentosError) {
      throw new Error(`Erro ao buscar agendamentos: ${agendamentosError.message}`);
    }
    
    if (!agendamentos || agendamentos.length === 0) {
      console.log('✅ Nenhum agendamento com paciente encontrado');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhuma notificação necessária',
          notificacoes_enviadas: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`📤 Processando ${agendamentos.length} notificações...`);
    
    const resultados = {
      total: agendamentos.length,
      enviados: 0,
      erros: 0,
      pulados: 0,
      detalhes: [] as Array<{paciente: string; status: string; motivo?: string}>
    };
    
    // Processar cada agendamento com rate limiting
    for (let i = 0; i < agendamentos.length; i++) {
      const agendamento = agendamentos[i];
      const paciente = agendamento.pacientes;
      const atendimento = agendamento.atendimentos;
      
      console.log(`\n📍 [${i + 1}/${agendamentos.length}] Processando: ${paciente.nome_completo}`);
      
      // Validar e formatar celular
      const celularFormatado = formatarCelular(paciente.celular || paciente.telefone);
      
      if (!celularFormatado) {
        console.warn(`⚠️ Paciente sem celular válido: ${paciente.nome_completo}`);
        resultados.pulados++;
        resultados.detalhes.push({
          paciente: paciente.nome_completo,
          status: 'pulado',
          motivo: 'Celular inválido ou ausente'
        });
        continue;
      }
      
      try {
        // Buscar próximas datas disponíveis via LLM Agent API
        console.log(`🔍 Buscando próximas datas para ${atendimento.nome}...`);
        
        const { data: disponibilidade, error: llmError } = await supabase.functions.invoke('llm-agent-api', {
          body: {
            action: 'availability',
            medico_nome: medico_nome,
            atendimento_nome: atendimento.nome,
            buscar_proximas: true,
            quantidade_dias: 14 // Buscar nas próximas 2 semanas
          }
        });
        
        let mensagem: string;
        
        if (llmError || !disponibilidade?.proximas_datas || disponibilidade.proximas_datas.length === 0) {
          console.warn(`⚠️ Sem datas disponíveis - usando mensagem fallback`);
          // Mensagem sem sugestão de datas
          mensagem = criarMensagemSemDatas({
            pacienteNome: paciente.nome_completo,
            medicoNome: medico_nome,
            dataOriginal: agendamento.data_agendamento,
            horaOriginal: agendamento.hora_agendamento,
            motivo: motivo
          });
        } else {
          console.log(`✅ ${disponibilidade.proximas_datas.length} datas encontradas`);
          // Mensagem com sugestão de datas
          mensagem = criarMensagemComDatas({
            pacienteNome: paciente.nome_completo,
            medicoNome: medico_nome,
            dataOriginal: agendamento.data_agendamento,
            horaOriginal: agendamento.hora_agendamento,
            motivo: motivo,
            proximasDatas: disponibilidade.proximas_datas
          });
        }
        
        // Enviar WhatsApp
        const whatsappResult = await enviarWhatsApp(celularFormatado, mensagem);
        console.log(`✅ WhatsApp enviado: ${paciente.nome_completo}`);
        
        // Registrar notificação no banco
        await supabase.from('notificacoes_enviadas').insert({
          agendamento_id: agendamento.id,
          paciente_id: paciente.id,
          tipo: 'bloqueio_agenda',
          mensagem: mensagem,
          celular: celularFormatado,
          status: 'enviado',
          cliente_id: '2bfb98b5-ae41-4f96-8ba7-acc797c22054' // IPADO
        });
        
        resultados.enviados++;
        resultados.detalhes.push({
          paciente: paciente.nome_completo,
          status: 'enviado'
        });
        
        // Rate limiting: aguardar antes do próximo envio
        if (i < agendamentos.length - 1) {
          console.log(`⏳ Aguardando ${DELAY_ENTRE_MENSAGENS}ms...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_ENTRE_MENSAGENS));
        }
        
      } catch (error: any) {
        console.error(`❌ Erro ao processar ${paciente.nome_completo}:`, error.message);
        
        // Registrar erro no banco
        await supabase.from('notificacoes_enviadas').insert({
          agendamento_id: agendamento.id,
          paciente_id: paciente.id,
          tipo: 'bloqueio_agenda',
          mensagem: 'Erro no envio',
          celular: celularFormatado,
          status: 'erro',
          erro: error.message,
          tentativas: 1,
          cliente_id: '2bfb98b5-ae41-4f96-8ba7-acc797c22054'
        });
        
        resultados.erros++;
        resultados.detalhes.push({
          paciente: paciente.nome_completo,
          status: 'erro',
          motivo: error.message
        });
      }
    }
    
    console.log('\n📊 RESUMO FINAL:');
    console.log(`✅ Enviados: ${resultados.enviados}`);
    console.log(`❌ Erros: ${resultados.erros}`);
    console.log(`⚠️ Pulados: ${resultados.pulados}`);
    
    // Log do processo completo
    await supabase.from('system_logs').insert({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Notificações de bloqueio processadas: ${resultados.enviados}/${resultados.total} enviadas`,
      context: 'NOTIFICAR_BLOQUEIO',
      data: {
        medico: medico_nome,
        periodo: `${data_inicio} a ${data_fim}`,
        motivo: motivo,
        resultados: resultados
      }
    });
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Notificações processadas: ${resultados.enviados} enviadas, ${resultados.erros} erros, ${resultados.pulados} pulados`,
        resultados: resultados
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('❌ ERRO GERAL:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
