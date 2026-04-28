import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ⚠️ SEGURANÇA: WhatsApp é processado via n8n (não diretamente nesta função)
// Esta função apenas prepara as notificações e salva no banco para n8n processar

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

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
  telefoneClinica: string;
  nomeClinica: string;
}): string {
  const { pacienteNome, medicoNome, dataOriginal, horaOriginal, motivo, proximasDatas, telefoneClinica, nomeClinica } = params;
  
  let mensagem = `🚨 IMPORTANTE: Reagendamento Necessário\n\n`;
  mensagem += `Olá, ${pacienteNome}!\n\n`;
  mensagem += `Sua consulta com ${medicoNome} no dia ${formatarData(dataOriginal)} às ${formatarHora(horaOriginal)}h foi cancelada.\n\n`;
  mensagem += `📋 Motivo: ${motivo}\n\n`;
  mensagem += `✅ PRÓXIMAS DATAS DISPONÍVEIS:\n\n`;
  
  proximasDatas.slice(0, 3).forEach((disponibilidade) => {
    mensagem += `📅 ${formatarData(disponibilidade.data)} - ${disponibilidade.dia_semana}\n`;
    mensagem += `🕐 ${disponibilidade.horarios.slice(0, 3).join(' | ')}\n\n`;
  });
  
  mensagem += `Para reagendar, responda este WhatsApp`;
  if (telefoneClinica) {
    mensagem += ` ou ligue:\n📞 ${telefoneClinica}`;
  }
  mensagem += `\n\n${nomeClinica}`;
  
  return mensagem;
}

// Função para criar mensagem de bloqueio SEM próximas datas (fallback)
function criarMensagemSemDatas(params: {
  pacienteNome: string;
  medicoNome: string;
  dataOriginal: string;
  horaOriginal: string;
  motivo: string;
  telefoneClinica: string;
  nomeClinica: string;
}): string {
  const { pacienteNome, medicoNome, dataOriginal, horaOriginal, motivo, telefoneClinica, nomeClinica } = params;
  
  let mensagem = `🚨 IMPORTANTE: Reagendamento Necessário\n\n`;
  mensagem += `Olá, ${pacienteNome}!\n\n`;
  mensagem += `Sua consulta com ${medicoNome} no dia ${formatarData(dataOriginal)} às ${formatarHora(horaOriginal)}h foi cancelada.\n\n`;
  mensagem += `📋 Motivo: ${motivo}\n\n`;
  mensagem += `⚠️ No momento não há vagas disponíveis na agenda online.\n\n`;
  mensagem += `Por favor, entre em contato para reagendar`;
  if (telefoneClinica) {
    mensagem += `:\n📞 ${telefoneClinica}`;
  }
  mensagem += `\n\n${nomeClinica}`;
  
  return mensagem;
}

serve(async (req) => {
  console.log('🚀 NOTIFICAR BLOQUEIO - Iniciando');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Validar API Key
  const apiKey = req.headers.get('x-api-key');
  const expectedApiKey = Deno.env.get('N8N_API_KEY');
  if (!apiKey || apiKey !== expectedApiKey) {
    console.error('❌ [NOTIFICAR-BLOQUEIO] Unauthorized: Invalid or missing API key');
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Invalid API Key' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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
      hora_inicio,
      hora_fim,
      motivo,
      agendamentos_afetados,
      cliente_id
    } = await req.json();

    const periodoHora = hora_inicio && hora_fim
      ? ` (${hora_inicio.substring(0, 5)}h às ${hora_fim.substring(0, 5)}h)`
      : '';
    
    console.log(`📋 Bloqueio criado: ${medico_nome} (${data_inicio} a ${data_fim})`);
    console.log(`👥 Agendamentos afetados: ${agendamentos_afetados}`);
    
    // Buscar cliente_id do médico se não fornecido
    let clienteIdFinal = cliente_id;
    if (!clienteIdFinal) {
      const { data: medico } = await supabase
        .from('medicos')
        .select('cliente_id')
        .eq('id', medico_id)
        .maybeSingle();
      clienteIdFinal = medico?.cliente_id || '2bfb98b5-ae41-4f96-8ba7-acc797c22054'; // Fallback IPADO
    }
    
    console.log(`🏥 Cliente ID: ${clienteIdFinal}`);
    
    // Buscar dados da clínica do banco
    const { data: clinicConfig } = await supabase
      .from('llm_clinic_config')
      .select('nome_clinica, telefone, whatsapp')
      .eq('cliente_id', clienteIdFinal)
      .maybeSingle();
    
    // Usar telefone do banco ou mensagem genérica (sem hardcode de número de outro cliente)
    const telefoneClinica = clinicConfig?.telefone || clinicConfig?.whatsapp || '';
    const nomeClinica = clinicConfig?.nome_clinica || 'Clínica';
    
    // Se não tiver telefone configurado, usar texto genérico nas mensagens
    const contatoClinica = telefoneClinica || 'nossos canais de atendimento';
    
    console.log(`📞 Contato: ${telefoneClinica} | ${nomeClinica}`);
    
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
      salvos: 0,
      erros: 0,
      pulados: 0,
      detalhes: [] as Array<{paciente: string; status: string; motivo?: string}>
    };
    
    // Processar cada agendamento
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
            motivo: motivo + periodoHora,
            telefoneClinica,
            nomeClinica
          });
        } else {
          console.log(`✅ ${disponibilidade.proximas_datas.length} datas encontradas`);
          // Mensagem com sugestão de datas
          mensagem = criarMensagemComDatas({
            pacienteNome: paciente.nome_completo,
            medicoNome: medico_nome,
            dataOriginal: agendamento.data_agendamento,
            horaOriginal: agendamento.hora_agendamento,
            motivo: motivo + periodoHora,
            proximasDatas: disponibilidade.proximas_datas,
            telefoneClinica,
            nomeClinica
          });
        }
        
        // ⚠️ SEGURANÇA: Apenas salva no banco - n8n é responsável por enviar via WhatsApp
        // Status 'pending_n8n' indica que n8n deve processar esta notificação
        await supabase.from('notificacoes_enviadas').insert({
          agendamento_id: agendamento.id,
          paciente_id: paciente.id,
          tipo: 'bloqueio_agenda',
          mensagem: mensagem,
          celular: celularFormatado,
          status: 'pending_n8n', // n8n monitora esta tabela e envia via Evolution API
          cliente_id: clienteIdFinal
        });
        
        console.log(`📋 Notificação salva para n8n processar: ${paciente.nome_completo}`);
        
        resultados.salvos++;
        resultados.detalhes.push({
          paciente: paciente.nome_completo,
          status: 'salvo_para_n8n'
        });
        
      } catch (error: any) {
        console.error(`❌ Erro ao processar ${paciente.nome_completo}:`, error.message);
        
        // Registrar erro no banco
        await supabase.from('notificacoes_enviadas').insert({
          agendamento_id: agendamento.id,
          paciente_id: paciente.id,
          tipo: 'bloqueio_agenda',
          mensagem: 'Erro no processamento',
          celular: celularFormatado,
          status: 'erro',
          erro: error.message,
          tentativas: 1,
          cliente_id: clienteIdFinal
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
    console.log(`✅ Salvos para n8n: ${resultados.salvos}`);
    console.log(`❌ Erros: ${resultados.erros}`);
    console.log(`⚠️ Pulados: ${resultados.pulados}`);
    
    // Log do processo completo
    await supabase.from('system_logs').insert({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Notificações de bloqueio processadas: ${resultados.salvos}/${resultados.total} salvas para n8n`,
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
        message: `Notificações processadas: ${resultados.salvos} salvas para n8n, ${resultados.erros} erros, ${resultados.pulados} pulados`,
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
