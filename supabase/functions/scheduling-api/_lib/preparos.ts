import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { enviarWhatsAppEvolution } from './whatsapp.ts'

// Função para enviar preparos automáticos
export async function enviarPreparosAutomaticos(appointment: any) {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Buscar preparos baseados no tipo de atendimento
    const { data: preparos, error } = await supabase
      .from('preparos')
      .select('*')
      .ilike('exame', `%${appointment.atendimentos.nome}%`)
      .limit(1);

    if (error) {
      console.error('❌ Erro ao buscar preparos:', error);
      return;
    }

    if (preparos && preparos.length > 0) {
      const preparo = preparos[0];
      const paciente = appointment.pacientes;
      
      // Montar mensagem de preparo
      const mensagem = montarMensagemPreparo(preparo, appointment);
      
      try {
        // Enviar WhatsApp real via Evolution API
        await enviarWhatsAppEvolution(paciente.celular, mensagem);
        console.log(`✅ Preparo enviado para ${paciente.nome_completo} - ${preparo.nome}`);
      } catch (whatsappError) {
        console.error(`❌ Falha ao enviar WhatsApp para ${paciente.celular}:`, whatsappError);
        // Mesmo com falha no WhatsApp, não interrompe o agendamento
      }
    } else {
      console.log(`ℹ️ Nenhum preparo específico encontrado para ${appointment.atendimentos.nome}`);
    }
  } catch (error) {
    console.error('❌ Erro ao enviar preparos automáticos:', error);
  }
}

// Função para montar mensagem de preparo
export function montarMensagemPreparo(preparo: any, appointment: any): string {
  const paciente = appointment.pacientes;
  const dataExame = new Date(appointment.data_agendamento).toLocaleDateString('pt-BR');
  const horaExame = appointment.hora_agendamento;
  
  let mensagem = `🏥 *PREPAROS PARA SEU EXAME*\n\n`;
  mensagem += `👤 *Paciente:* ${paciente.nome_completo}\n`;
  mensagem += `📅 *Data:* ${dataExame}\n`;
  mensagem += `⏰ *Horário:* ${horaExame}\n`;
  mensagem += `🔬 *Exame:* ${preparo.nome}\n\n`;
  
  mensagem += `📋 *INSTRUÇÕES IMPORTANTES:*\n\n`;
  
  if (preparo.jejum_horas) {
    mensagem += `⏱️ *Jejum:* ${preparo.jejum_horas} horas antes do exame\n\n`;
  }
  
  if (preparo.restricoes_alimentares) {
    mensagem += `🚫 *Restrições Alimentares:*\n${preparo.restricoes_alimentares}\n\n`;
  }
  
  if (preparo.medicacao_suspender) {
    mensagem += `💊 *Medicações a Suspender:*\n${preparo.medicacao_suspender}\n\n`;
  }
  
  if (preparo.itens_levar) {
    mensagem += `🎒 *Itens para levar:*\n${preparo.itens_levar}\n\n`;
  }
  
  if (preparo.observacoes_especiais) {
  mensagem += `⚠️ *Observações Especiais:*\n${preparo.observacoes_especiais}\n\n`;
  }
  
  // Adicionar informações de valor se disponíveis
  if (preparo.valor_particular || preparo.valor_convenio) {
    mensagem += `💰 *VALORES:*\n`;
    if (preparo.valor_particular) {
      mensagem += `💵 Particular: R$ ${preparo.valor_particular.toFixed(2)}\n`;
    }
    if (preparo.valor_convenio) {
      mensagem += `🏥 Convênio: R$ ${preparo.valor_convenio.toFixed(2)}\n`;
    }
    if (preparo.forma_pagamento) {
      mensagem += `💳 Forma de pagamento: ${preparo.forma_pagamento}\n`;
    }
    if (preparo.observacoes_valor) {
      mensagem += `📝 Obs. valores: ${preparo.observacoes_valor}\n`;
    }
    mensagem += `\n`;
  }
  
  if (preparo.instrucoes) {
    mensagem += `📝 *Instruções Detalhadas:*\n`;
    if (Array.isArray(preparo.instrucoes)) {
      preparo.instrucoes.forEach((instrucao: string, index: number) => {
        mensagem += `${index + 1}. ${instrucao}\n`;
      });
    } else if (typeof preparo.instrucoes === 'object') {
      Object.entries(preparo.instrucoes).forEach(([key, value]) => {
        mensagem += `• *${key}:* ${value}\n`;
      });
    }
    mensagem += `\n`;
  }
  
  mensagem += `📞 *Dúvidas?* Entre em contato conosco!\n`;
  mensagem += `\n🏥 *ENDOGASTRO - Clínica de Gastroenterologia*`;
  
  return mensagem;
}