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

interface AgendamentoData {
  nome: string;
  dataNascimento: string;
  convenio: string;
  telefone: string;
  celular: string;
  medico: string;
  atendimento: string;
  data: string;
  hora: string;
  observacoes?: string;
}

// Sistema de sessões para conversas em andamento
const userSessions = new Map<string, any>();

// Função para extrair dados de agendamento da mensagem
function extrairDadosAgendamento(texto: string): Partial<AgendamentoData> {
  const dados: Partial<AgendamentoData> = {};
  
  // Regex patterns para extrair informações
  const patterns = {
    nome: /nome[:\s]*([^\n,]+)/i,
    dataNascimento: /(?:nascimento|nasceu|idade)[:\s]*(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}-\d{1,2}-\d{4})/i,
    convenio: /convenio[:\s]*([^\n,]+)/i,
    telefone: /(?:telefone|fone)[:\s]*(\d{10,11})/i,
    celular: /(?:celular|whats)[:\s]*(\d{10,11})/i,
    data: /data[:\s]*(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}-\d{1,2}-\d{4})/i,
    hora: /(?:hora|horário)[:\s]*(\d{1,2}[:\s]*\d{2})/i
  };
  
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = texto.match(pattern);
    if (match) {
      dados[key as keyof AgendamentoData] = match[1].trim();
    }
  }
  
  return dados;
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
• *agendar* - Fazer novo agendamento
• *remarcar* - Alterar agendamento existente
• *cancelar* - Cancelar agendamento
• *consultar* - Ver meus agendamentos
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

  // Verificar valores de procedimentos (incluindo busca por nome do médico)
  if (texto.includes('valor') || texto.includes('preço') || texto.includes('preco') || texto.includes('custo') || texto.includes('quanto custa')) {
    try {
      // Detectar se mencionou nome de médico na consulta
      const nomesPossiveisMedicos = ['dra', 'dr', 'doutor', 'doutora', 'psicóloga', 'psicologa', 'camila', 'helena'];
      const contemNomeMedico = nomesPossiveisMedicos.some(nome => 
        texto.toLowerCase().includes(nome)
      );
      
      let query = supabase
        .from('atendimentos')
        .select('nome, valor_particular, coparticipacao_unimed_20, coparticipacao_unimed_40, medico_nome')
        .not('valor_particular', 'is', null);
      
      // Se mencionou nome de médico, filtrar por medico_nome
      if (contemNomeMedico) {
        // Buscar por fragmentos do nome do médico no texto
        if (texto.toLowerCase().includes('camila') || texto.toLowerCase().includes('helena')) {
          query = query.ilike('medico_nome', '%Camila Helena%');
        }
        // Adicionar outros médicos conforme necessário
        // Exemplo: if (texto.includes('outro_medico')) { query = query.ilike('medico_nome', '%Nome do Médico%'); }
      }
      
      const { data: valores } = await query.order('nome');
      
      if (valores && valores.length > 0) {
        let resposta = '';
        
        if (contemNomeMedico && valores[0].medico_nome) {
          resposta = `💰 *Valores das consultas com ${valores[0].medico_nome}:*\n\n`;
        } else {
          resposta = '💰 *Nossos valores de consultas e exames:*\n\n';
        }
        
        valores.forEach((valor: any) => {
          resposta += `📋 **${valor.nome}**\n`;
          if (valor.valor_particular) {
            resposta += `• Particular: R$ ${valor.valor_particular}\n`;
          }
          if (valor.coparticipacao_unimed_20) {
            resposta += `• Unimed (20%): R$ ${valor.coparticipacao_unimed_20}\n`;
          }
          if (valor.coparticipacao_unimed_40) {
            resposta += `• Unimed (40%): R$ ${valor.coparticipacao_unimed_40}\n`;
          }
          resposta += '\n';
        });
        
        resposta += 'Posso ajudar com agendamento? 😊';
        return { message: resposta };
      } else if (contemNomeMedico) {
        // Se buscou por médico específico mas não encontrou valores
        return { 
          message: 'No momento, não encontrei valores específicos para este médico na base de dados.\n\nPosso ajudar com outras informações ou agendamento? 😊'
        };
      } else {
        return {
          message: 'No momento, não temos valores disponíveis na consulta.\n\nPara informações sobre valores, entre em contato:\n📞 (XX) XXXX-XXXX'
        };
      }
    } catch (error) {
      return { message: '❌ Erro ao consultar valores. Tente novamente.' };
    }
  }

  // Agendar consulta
  if (texto.includes('agendar') || texto.includes('consulta') || texto.includes('marcar')) {
    // Verificar se já tem sessão ativa para agendamento
    const sessao = userSessions.get(celular);
    
    if (!sessao || sessao.tipo !== 'agendamento') {
      // Iniciar nova sessão de agendamento
      userSessions.set(celular, { 
        tipo: 'agendamento', 
        etapa: 'nome',
        dados: {}
      });
      
      return {
        message: `📅 *Novo Agendamento*

Vou te ajudar a agendar sua consulta! 😊

📝 Para começar, me informe seu *nome completo*:`
      };
    }
    
    // Processar dados da etapa atual
    const etapa = sessao.etapa;
    const dados = sessao.dados;
    
    switch (etapa) {
      case 'nome':
        dados.nome = message.body.trim();
        sessao.etapa = 'nascimento';
        userSessions.set(celular, sessao);
        return {
          message: `✅ Nome: ${dados.nome}

📅 Agora preciso da sua *data de nascimento* (DD/MM/AAAA):`
        };
        
      case 'nascimento':
        const dataMatch = message.body.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (!dataMatch) {
          return {
            message: `❌ Data inválida. Use o formato DD/MM/AAAA (ex: 15/03/1990):`
          };
        }
        dados.dataNascimento = `${dataMatch[3]}-${dataMatch[2].padStart(2, '0')}-${dataMatch[1].padStart(2, '0')}`;
        sessao.etapa = 'convenio';
        userSessions.set(celular, sessao);
        return {
          message: `✅ Data de nascimento: ${dataMatch[1]}/${dataMatch[2]}/${dataMatch[3]}

🏥 Qual seu *convênio*? (ex: Unimed, SulAmérica, Particular):`
        };
        
      case 'convenio':
        dados.convenio = message.body.trim();
        sessao.etapa = 'telefone';
        userSessions.set(celular, sessao);
        return {
          message: `✅ Convênio: ${dados.convenio}

📞 Me informe seu *telefone* (com DDD):`
        };
        
      case 'telefone':
        const telefoneMatch = message.body.match(/(\d{10,11})/);
        if (!telefoneMatch) {
          return {
            message: `❌ Telefone inválido. Use apenas números com DDD (ex: 11999887766):`
          };
        }
        dados.telefone = telefoneMatch[1];
        dados.celular = celular.replace(/\D/g, '');
        sessao.etapa = 'medico';
        userSessions.set(celular, sessao);
        
        // Buscar médicos disponíveis
        try {
          const { data: medicos } = await supabase
            .from('medicos')
            .select('id, nome, especialidade')
            .eq('ativo', true);
            
          let medicosTexto = '👨‍⚕️ *Escolha o médico:*\n\n';
          medicos?.forEach((medico: any, index: any) => {
            medicosTexto += `${index + 1}. *${medico.nome}* - ${medico.especialidade}\n`;
          });
          medicosTexto += `\nDigite o *número* do médico desejado:`;
          
          sessao.medicos = medicos;
          userSessions.set(celular, sessao);
          
          return { message: medicosTexto };
        } catch (error) {
          return { message: '❌ Erro ao buscar médicos. Tente novamente digitando *agendar*.' };
        }
        
      case 'medico':
        const medicoIndex = parseInt(message.body.trim()) - 1;
        if (!sessao.medicos || medicoIndex < 0 || medicoIndex >= sessao.medicos.length) {
          return {
            message: `❌ Número inválido. Escolha um número da lista de médicos:`
          };
        }
        
        dados.medico = sessao.medicos[medicoIndex];
        sessao.etapa = 'atendimento';
        userSessions.set(celular, sessao);
        
        // Buscar atendimentos do médico
        try {
          const { data: atendimentos } = await supabase
            .from('atendimentos')
            .select('id, nome, tipo')
            .eq('medico_id', dados.medico.id)
            .eq('ativo', true);
            
          if (!atendimentos || atendimentos.length === 0) {
            return { message: '❌ Médico sem atendimentos disponíveis. Digite *agendar* para recomeçar.' };
          }
          
          let atendimentosTexto = `✅ Médico: ${dados.medico.nome}\n\n🔬 *Escolha o tipo de atendimento:*\n\n`;
          atendimentos.forEach((atend: any, index: any) => {
            atendimentosTexto += `${index + 1}. *${atend.nome}* (${atend.tipo})\n`;
          });
          atendimentosTexto += `\nDigite o *número* do atendimento desejado:`;
          
          sessao.atendimentos = atendimentos;
          userSessions.set(celular, sessao);
          
          return { message: atendimentosTexto };
        } catch (error) {
          return { message: '❌ Erro ao buscar atendimentos. Tente novamente.' };
        }
        
      case 'atendimento':
        const atendIndex = parseInt(message.body.trim()) - 1;
        if (!sessao.atendimentos || atendIndex < 0 || atendIndex >= sessao.atendimentos.length) {
          return {
            message: `❌ Número inválido. Escolha um número da lista de atendimentos:`
          };
        }
        
        dados.atendimento = sessao.atendimentos[atendIndex];
        sessao.etapa = 'data';
        userSessions.set(celular, sessao);
        
        return {
          message: `✅ Atendimento: ${dados.atendimento.nome}

📅 Qual *data* você prefere? (DD/MM/AAAA):`
        };
        
      case 'data':
        const dataAgendMatch = message.body.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (!dataAgendMatch) {
          return {
            message: `❌ Data inválida. Use o formato DD/MM/AAAA (ex: 20/12/2024):`
          };
        }
        
        const dataAgend = `${dataAgendMatch[3]}-${dataAgendMatch[2].padStart(2, '0')}-${dataAgendMatch[1].padStart(2, '0')}`;
        const hoje = new Date();
        const dataEscolhida = new Date(dataAgend);
        
        if (dataEscolhida <= hoje) {
          return {
            message: `❌ A data deve ser futura. Escolha uma data a partir de amanhã:`
          };
        }
        
        dados.dataAgendamento = dataAgend;
        sessao.etapa = 'hora';
        userSessions.set(celular, sessao);
        
        return {
          message: `✅ Data: ${dataAgendMatch[1]}/${dataAgendMatch[2]}/${dataAgendMatch[3]}

⏰ Qual *horário* você prefere? (HH:MM ex: 14:30):`
        };
        
      case 'hora':
        const horaMatch = message.body.match(/(\d{1,2})[:\s](\d{2})/);
        if (!horaMatch) {
          return {
            message: `❌ Horário inválido. Use o formato HH:MM (ex: 14:30):`
          };
        }
        
        dados.horaAgendamento = `${horaMatch[1].padStart(2, '0')}:${horaMatch[2]}`;
        sessao.etapa = 'confirmacao';
        userSessions.set(celular, sessao);
        
        return {
          message: `📋 *Confirme os dados do agendamento:*

👤 Nome: ${dados.nome}
📅 Nascimento: ${dados.dataNascimento.split('-').reverse().join('/')}
🏥 Convênio: ${dados.convenio}
📞 Telefone: ${dados.telefone}
👨‍⚕️ Médico: ${dados.medico.nome}
🔬 Atendimento: ${dados.atendimento.nome}
📅 Data: ${dados.dataAgendamento.split('-').reverse().join('/')}
⏰ Horário: ${dados.horaAgendamento}

✅ Digite *confirmar* para finalizar
❌ Digite *cancelar* para desistir`
        };
        
      case 'confirmacao':
        if (texto.includes('confirmar')) {
          // Criar agendamento usando função do Supabase
          try {
            const { data: resultado } = await supabase.rpc('criar_agendamento_atomico', {
              p_nome_completo: dados.nome,
              p_data_nascimento: dados.dataNascimento,
              p_convenio: dados.convenio,
              p_telefone: dados.telefone,
              p_celular: dados.celular,
              p_medico_id: dados.medico.id,
              p_atendimento_id: dados.atendimento.id,
              p_data_agendamento: dados.dataAgendamento,
              p_hora_agendamento: dados.horaAgendamento,
              p_observacoes: 'Agendado via WhatsApp',
              p_criado_por: 'whatsapp_agent'
            });
            
            // Limpar sessão
            userSessions.delete(celular);
            
            if (resultado && resultado.success) {
              return {
                message: `🎉 *Agendamento realizado com sucesso!*

📋 **Detalhes do seu agendamento:**
👤 Paciente: ${dados.nome}
👨‍⚕️ Médico: ${dados.medico.nome}
🔬 Atendimento: ${dados.atendimento.nome}
📅 Data: ${dados.dataAgendamento.split('-').reverse().join('/')}
⏰ Horário: ${dados.horaAgendamento}

📞 Para alterações, ligue: (XX) XXXX-XXXX

Muito obrigado! 😊`
              };
            } else {
              return {
                message: `❌ *Erro ao criar agendamento:*

${resultado?.error || 'Erro desconhecido'}

Digite *agendar* para tentar novamente.`
              };
            }
          } catch (error) {
            userSessions.delete(celular);
            return {
              message: `❌ Erro no sistema. Tente novamente digitando *agendar* ou ligue para (XX) XXXX-XXXX`
            };
          }
        } else if (texto.includes('cancelar')) {
          userSessions.delete(celular);
          return {
            message: `❌ Agendamento cancelado.

Digite *agendar* se quiser tentar novamente.`
          };
        } else {
          return {
            message: `Digite *confirmar* para finalizar ou *cancelar* para desistir:`
          };
        }
    }
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

  // Consultar agendamentos
  if (texto.includes('consultar') || texto.includes('meus agendamentos') || texto.includes('agendado')) {
    const sessao = userSessions.get(celular);
    
    if (!sessao || sessao.tipo !== 'consulta') {
      userSessions.set(celular, { 
        tipo: 'consulta', 
        etapa: 'nome'
      });
      
      return {
        message: `🔍 *Consultar Agendamentos*

Para consultar seus agendamentos, preciso do seu *nome completo*:`
      };
    }
    
    if (sessao.etapa === 'nome') {
      const nome = message.body.trim();
      
      try {
        // Buscar agendamentos do paciente
        const { data: agendamentos } = await supabase
          .from('agendamentos')
          .select(`
            id,
            data_agendamento,
            hora_agendamento,
            status,
            observacoes,
            pacientes!inner(nome_completo, convenio),
            medicos!inner(nome, especialidade),
            atendimentos!inner(nome, tipo)
          `)
          .ilike('pacientes.nome_completo', `%${nome}%`)
          .in('status', ['agendado', 'confirmado'])
          .gte('data_agendamento', new Date().toISOString().split('T')[0])
          .order('data_agendamento', { ascending: true })
          .order('hora_agendamento', { ascending: true });
        
        userSessions.delete(celular);
        
        if (!agendamentos || agendamentos.length === 0) {
          return {
            message: `❌ Nenhum agendamento encontrado para "${nome}".

• Verifique se o nome está correto
• Talvez não tenha agendamentos futuros

Digite *agendar* para fazer um novo agendamento.`
          };
        }
        
        let resposta = `📋 *Agendamentos de ${nome}:*\n\n`;
        
        agendamentos.forEach((agend: any, index: any) => {
          const data = new Date(agend.data_agendamento).toLocaleDateString('pt-BR');
          resposta += `${index + 1}. 📅 ${data} às ${agend.hora_agendamento}\n`;
          resposta += `   👨‍⚕️ Dr(a). ${agend.medicos.nome}\n`;
          resposta += `   🔬 ${agend.atendimentos.nome}\n`;
          resposta += `   📍 Status: ${agend.status === 'agendado' ? 'Agendado' : 'Confirmado'}\n\n`;
        });
        
        resposta += `💡 Para remarcar: digite *remarcar*
💡 Para cancelar: digite *cancelar*`;
        
        return { message: resposta };
      } catch (error) {
        userSessions.delete(celular);
        return { message: '❌ Erro ao consultar agendamentos. Tente novamente.' };
      }
    }
  }

  // Remarcar agendamento
  if (texto.includes('remarcar') || texto.includes('alterar') || texto.includes('mudar data')) {
    const sessao = userSessions.get(celular);
    
    if (!sessao || sessao.tipo !== 'remarcar') {
      userSessions.set(celular, { 
        tipo: 'remarcar', 
        etapa: 'nome'
      });
      
      return {
        message: `📅 *Remarcar Agendamento*

Para remarcar seu agendamento, preciso do seu *nome completo*:`
      };
    }
    
    switch (sessao.etapa) {
      case 'nome':
        const nome = message.body.trim();
        
        try {
          // Buscar agendamentos futuros do paciente
          const { data: agendamentos } = await supabase
            .from('agendamentos')
            .select(`
              id,
              data_agendamento,
              hora_agendamento,
              status,
              pacientes!inner(nome_completo, id),
              medicos!inner(nome, especialidade, id),
              atendimentos!inner(nome, tipo, id)
            `)
            .ilike('pacientes.nome_completo', `%${nome}%`)
            .in('status', ['agendado', 'confirmado'])
            .gte('data_agendamento', new Date().toISOString().split('T')[0])
            .order('data_agendamento', { ascending: true });
          
          if (!agendamentos || agendamentos.length === 0) {
            userSessions.delete(celular);
            return {
              message: `❌ Nenhum agendamento futuro encontrado para "${nome}".

Digite *agendar* para fazer um novo agendamento.`
            };
          }
          
          let resposta = `📋 *Escolha qual agendamento remarcar:*\n\n`;
          agendamentos.forEach((agend: any, index: any) => {
            const data = new Date(agend.data_agendamento).toLocaleDateString('pt-BR');
            resposta += `${index + 1}. ${data} às ${agend.hora_agendamento}\n`;
            resposta += `   👨‍⚕️ Dr(a). ${agend.medicos.nome}\n`;
            resposta += `   🔬 ${agend.atendimentos.nome}\n\n`;
          });
          resposta += 'Digite o *número* do agendamento:';
          
          sessao.etapa = 'escolher';
          sessao.agendamentos = agendamentos;
          userSessions.set(celular, sessao);
          
          return { message: resposta };
        } catch (error) {
          userSessions.delete(celular);
          return { message: '❌ Erro ao buscar agendamentos. Tente novamente.' };
        }
        
      case 'escolher':
        const agendIndex = parseInt(message.body.trim()) - 1;
        if (!sessao.agendamentos || agendIndex < 0 || agendIndex >= sessao.agendamentos.length) {
          return {
            message: `❌ Número inválido. Escolha um número da lista:`
          };
        }
        
        sessao.agendamentoSelecionado = sessao.agendamentos[agendIndex];
        sessao.etapa = 'nova_data';
        userSessions.set(celular, sessao);
        
        const agendSelecionado = sessao.agendamentoSelecionado;
        const dataAtual = new Date(agendSelecionado.data_agendamento).toLocaleDateString('pt-BR');
        
        return {
          message: `✅ Agendamento selecionado:
📅 ${dataAtual} às ${agendSelecionado.hora_agendamento}
👨‍⚕️ Dr(a). ${agendSelecionado.medicos.nome}

📅 Qual a *nova data* desejada? (DD/MM/AAAA):`
        };
        
      case 'nova_data':
        const dataMatch = message.body.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (!dataMatch) {
          return {
            message: `❌ Data inválida. Use o formato DD/MM/AAAA:`
          };
        }
        
        const novaData = `${dataMatch[3]}-${dataMatch[2].padStart(2, '0')}-${dataMatch[1].padStart(2, '0')}`;
        const hoje = new Date();
        const dataEscolhida = new Date(novaData);
        
        if (dataEscolhida <= hoje) {
          return {
            message: `❌ A data deve ser futura. Escolha uma data a partir de amanhã:`
          };
        }
        
        sessao.novaData = novaData;
        sessao.etapa = 'nova_hora';
        userSessions.set(celular, sessao);
        
        return {
          message: `✅ Nova data: ${dataMatch[1]}/${dataMatch[2]}/${dataMatch[3]}

⏰ Qual o *novo horário*? (HH:MM ex: 14:30):`
        };
        
      case 'nova_hora':
        const horaMatch = message.body.match(/(\d{1,2})[:\s](\d{2})/);
        if (!horaMatch) {
          return {
            message: `❌ Horário inválido. Use o formato HH:MM:`
          };
        }
        
        const novaHora = `${horaMatch[1].padStart(2, '0')}:${horaMatch[2]}`;
        sessao.novaHora = novaHora;
        sessao.etapa = 'confirmar_remarcacao';
        userSessions.set(celular, sessao);
        
        const agend = sessao.agendamentoSelecionado;
        return {
          message: `📋 *Confirme a remarcação:*

🔄 *ANTES:*
📅 ${new Date(agend.data_agendamento).toLocaleDateString('pt-BR')} às ${agend.hora_agendamento}

📅 *DEPOIS:*
📅 ${sessao.novaData.split('-').reverse().join('/')} às ${novaHora}
👨‍⚕️ Dr(a). ${agend.medicos.nome}
🔬 ${agend.atendimentos.nome}

✅ Digite *confirmar* para remarcar
❌ Digite *cancelar* para desistir`
        };
        
      case 'confirmar_remarcacao':
        if (texto.includes('confirmar')) {
          try {
            // Atualizar agendamento
            const { error } = await supabase
              .from('agendamentos')
              .update({
                data_agendamento: sessao.novaData,
                hora_agendamento: sessao.novaHora,
                observacoes: (sessao.agendamentoSelecionado.observacoes || '') + ' - Remarcado via WhatsApp'
              })
              .eq('id', sessao.agendamentoSelecionado.id);
            
            userSessions.delete(celular);
            
            if (error) {
              return {
                message: `❌ Erro ao remarcar: ${error.message}

Tente novamente ou ligue para (XX) XXXX-XXXX`
              };
            }
            
            return {
              message: `✅ *Agendamento remarcado com sucesso!*

📋 **Novos detalhes:**
📅 Data: ${sessao.novaData.split('-').reverse().join('/')}
⏰ Horário: ${sessao.novaHora}
👨‍⚕️ Médico: ${sessao.agendamentoSelecionado.medicos.nome}

Muito obrigado! 😊`
            };
          } catch (error) {
            userSessions.delete(celular);
            return {
              message: `❌ Erro no sistema. Tente novamente ou ligue para (XX) XXXX-XXXX`
            };
          }
        } else if (texto.includes('cancelar')) {
          userSessions.delete(celular);
          return {
            message: `❌ Remarcação cancelada.

Digite *remarcar* para tentar novamente.`
          };
        } else {
          return {
            message: `Digite *confirmar* para remarcar ou *cancelar* para desistir:`
          };
        }
    }
  }

  // Cancelar agendamento
  if (texto.includes('cancelar') || texto.includes('desmarcar')) {
    const sessao = userSessions.get(celular);
    
    if (!sessao || sessao.tipo !== 'cancelar') {
      userSessions.set(celular, { 
        tipo: 'cancelar', 
        etapa: 'nome'
      });
      
      return {
        message: `❌ *Cancelar Agendamento*

Para cancelar seu agendamento, preciso do seu *nome completo*:`
      };
    }
    
    switch (sessao.etapa) {
      case 'nome':
        const nome = message.body.trim();
        
        try {
          // Buscar agendamentos futuros do paciente
          const { data: agendamentos } = await supabase
            .from('agendamentos')
            .select(`
              id,
              data_agendamento,
              hora_agendamento,
              status,
              pacientes!inner(nome_completo),
              medicos!inner(nome, especialidade),
              atendimentos!inner(nome, tipo)
            `)
            .ilike('pacientes.nome_completo', `%${nome}%`)
            .in('status', ['agendado', 'confirmado'])
            .gte('data_agendamento', new Date().toISOString().split('T')[0])
            .order('data_agendamento', { ascending: true });
          
          if (!agendamentos || agendamentos.length === 0) {
            userSessions.delete(celular);
            return {
              message: `❌ Nenhum agendamento futuro encontrado para "${nome}".`
            };
          }
          
          let resposta = `📋 *Escolha qual agendamento cancelar:*\n\n`;
          agendamentos.forEach((agend: any, index: any) => {
            const data = new Date(agend.data_agendamento).toLocaleDateString('pt-BR');
            resposta += `${index + 1}. ${data} às ${agend.hora_agendamento}\n`;
            resposta += `   👨‍⚕️ Dr(a). ${agend.medicos.nome}\n`;
            resposta += `   🔬 ${agend.atendimentos.nome}\n\n`;
          });
          resposta += 'Digite o *número* do agendamento:';
          
          sessao.etapa = 'escolher';
          sessao.agendamentos = agendamentos;
          userSessions.set(celular, sessao);
          
          return { message: resposta };
        } catch (error) {
          userSessions.delete(celular);
          return { message: '❌ Erro ao buscar agendamentos. Tente novamente.' };
        }
        
      case 'escolher':
        const agendIndex = parseInt(message.body.trim()) - 1;
        if (!sessao.agendamentos || agendIndex < 0 || agendIndex >= sessao.agendamentos.length) {
          return {
            message: `❌ Número inválido. Escolha um número da lista:`
          };
        }
        
        sessao.agendamentoSelecionado = sessao.agendamentos[agendIndex];
        sessao.etapa = 'confirmar_cancelamento';
        userSessions.set(celular, sessao);
        
        const agendParaCancelar = sessao.agendamentoSelecionado;
        const dataCancel = new Date(agendParaCancelar.data_agendamento).toLocaleDateString('pt-BR');
        
        return {
          message: `⚠️ *Confirme o cancelamento:*

📅 ${dataCancel} às ${agendParaCancelar.hora_agendamento}
👨‍⚕️ Dr(a). ${agendParaCancelar.medicos.nome}
🔬 ${agendParaCancelar.atendimentos.nome}

❌ Digite *confirmar* para cancelar
✅ Digite *manter* para manter o agendamento

⚠️ *Importante:* O cancelamento é definitivo!`
        };
        
      case 'confirmar_cancelamento':
        if (texto.includes('confirmar')) {
          try {
            // Cancelar agendamento
            const { error } = await supabase
              .from('agendamentos')
              .update({
                status: 'cancelado',
                observacoes: (sessao.agendamentoSelecionado.observacoes || '') + ' - Cancelado via WhatsApp'
              })
              .eq('id', sessao.agendamentoSelecionado.id);
            
            userSessions.delete(celular);
            
            if (error) {
              return {
                message: `❌ Erro ao cancelar: ${error.message}

Tente novamente ou ligue para (XX) XXXX-XXXX`
              };
            }
            
            return {
              message: `✅ *Agendamento cancelado com sucesso!*

O horário ficará disponível para outros pacientes.

📞 Para reagendar, ligue: (XX) XXXX-XXXX
💬 Ou digite *agendar* para marcar pelo WhatsApp

Obrigado! 😊`
            };
          } catch (error) {
            userSessions.delete(celular);
            return {
              message: `❌ Erro no sistema. Tente novamente ou ligue para (XX) XXXX-XXXX`
            };
          }
        } else if (texto.includes('manter')) {
          userSessions.delete(celular);
          return {
            message: `✅ Agendamento mantido.

Seu agendamento continua ativo. Até breve! 😊`
          };
        } else {
          return {
            message: `Digite *confirmar* para cancelar ou *manter* para manter o agendamento:`
          };
        }
    }
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
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});