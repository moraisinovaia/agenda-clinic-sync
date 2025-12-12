import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// v1.0.0 - LLM Agent API para Clínica Vênus
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🏥 ID da Clínica Vênus
const CLINICA_VENUS_ID = '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a';

// 📞 Contatos da Clínica Vênus
const CLINIC_INFO = {
  nome: 'Clínica Vênus',
  endereco: 'Rua das Orquídeas, 210 – Centro, Cidade Vênus – SP',
  whatsapp: '(11) 90000-0000',
  telefone: '(11) 4000-0000',
  email: 'contato@clinicavenus.com',
  horario_funcionamento: 'Segunda a Sexta: 08h às 19h | Sábado: 08h às 12h',
  formas_pagamento: 'Pix, cartão ou dinheiro',
  limite_pacientes: {
    seg_sex: 5,
    sabado: 4
  }
};

// 🌎 Função para obter data E HORA atual no fuso horário de São Paulo
function getDataHoraAtualBrasil() {
  const agora = new Date();
  const brasilTime = agora.toLocaleString('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  const [data, hora] = brasilTime.split(', ');
  const [dia, mes, ano] = data.split('/');
  const [horaNum, minutoNum] = hora.split(':').map(Number);
  
  return {
    data: `${ano}-${mes}-${dia}`,
    hora: horaNum,
    minuto: minutoNum,
    horarioEmMinutos: horaNum * 60 + minutoNum
  };
}

function getDataAtualBrasil(): string {
  return getDataHoraAtualBrasil().data;
}

// Função auxiliar para obter dia da semana (0=dom, 1=seg, ...)
function getDiaSemana(data: string): number {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(ano, mes - 1, dia).getDay();
}

const diasNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Regras de negócio para Clínica Vênus
const BUSINESS_RULES_VENUS = {
  medicos: {
    // Dr. João Silva - Cardiologista - HORA MARCADA
    '25440cf9-7832-4034-9e2a-9d8ee9b4d12d': {
      nome: 'DR. JOÃO SILVA',
      especialidade: 'Cardiologista',
      tipo_agendamento: 'hora_marcada',
      servicos: {
        'Consulta Cardiológica': {
          permite_online: true,
          tipo: 'hora_marcada',
          dias_semana: [1, 3, 5], // segunda, quarta, sexta
          periodos: {
            tarde_seg_qua: { 
              inicio: '14:00', 
              fim: '19:00', 
              intervalo_minutos: 30,
              limite: 6, // 6 pacientes seg/qua
              dias_especificos: [1, 3] // seg e qua
            },
            manha_sex: { 
              inicio: '08:00', 
              fim: '12:00', 
              intervalo_minutos: 30,
              limite: 3, // 3 pacientes sexta
              dias_especificos: [5] // sexta
            }
          },
          valor: 300.00,
          retorno_gratuito_dias: 30,
          convenios_aceitos: ['PARTICULAR', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED REGIONAL', 'UNIMED INTERCAMBIO', 'UNIMED NACIONAL']
        },
        'Eletrocardiograma': {
          permite_online: true,
          tipo: 'hora_marcada',
          dias_semana: [1, 3, 5],
          periodos: {
            tarde_seg_qua: { 
              inicio: '14:00', 
              fim: '19:00', 
              intervalo_minutos: 20,
              limite: 6,
              dias_especificos: [1, 3]
            },
            manha_sex: { 
              inicio: '08:00', 
              fim: '12:00', 
              intervalo_minutos: 20,
              limite: 3,
              dias_especificos: [5]
            }
          },
          valor: 150.00,
          convenios_aceitos: ['PARTICULAR', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED REGIONAL', 'UNIMED INTERCAMBIO', 'UNIMED NACIONAL']
        }
      }
    },
    
    // Dra. Gabriela Batista - Gastroenterologista - ORDEM DE CHEGADA
    '4361d620-4c9b-4602-aab1-e835cc63c8a2': {
      nome: 'DRA. GABRIELA BATISTA',
      especialidade: 'Gastroenterologista',
      tipo_agendamento: 'ordem_chegada',
      servicos: {
        'Consulta Gastroenterológica': {
          permite_online: true,
          tipo: 'ordem_chegada',
          dias_semana: [2, 4, 6], // terça, quinta, sábado
          periodos: {
            integral: { 
              inicio: '08:00', 
              fim: '16:00', 
              limite: 8, // 8 pacientes ter/qui
              dias_especificos: [2, 4], // ter e qui
              distribuicao_fichas: '08:00 às 12:00'
            },
            manha_sab: { 
              inicio: '08:00', 
              fim: '12:00', 
              limite: 4, // 4 pacientes sábado
              dias_especificos: [6], // sábado
              distribuicao_fichas: '08:00 às 10:00'
            }
          },
          valor: 280.00,
          retorno_gratuito_dias: 20,
          convenios_aceitos: ['PARTICULAR', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED REGIONAL', 'UNIMED INTERCAMBIO', 'UNIMED NACIONAL']
        },
        'Endoscopia Digestiva Alta': {
          permite_online: true,
          tipo: 'ordem_chegada',
          dias_semana: [2, 4, 6],
          periodos: {
            integral: { 
              inicio: '08:00', 
              fim: '16:00', 
              limite: 8, // 8 pacientes ter/qui (proporcional)
              dias_especificos: [2, 4],
              distribuicao_fichas: '08:00 às 10:00'
            },
            manha_sab: { 
              inicio: '08:00', 
              fim: '12:00', 
              limite: 4, // 4 pacientes sábado
              dias_especificos: [6],
              distribuicao_fichas: '08:00 às 09:00'
            }
          },
          valor: 500.00,
          convenios_aceitos: ['PARTICULAR', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED REGIONAL', 'UNIMED INTERCAMBIO', 'UNIMED NACIONAL'],
          requer_preparo: true
        }
      }
    }
  }
};

// ============= FUNÇÕES DE RESPOSTA =============

function successResponse(data: any) {
  return new Response(JSON.stringify({
    success: true,
    ...data
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200
  });
}

function businessErrorResponse(data: any) {
  return new Response(JSON.stringify({
    success: false,
    ...data
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200
  });
}

// ============= FUNÇÕES DE NORMALIZAÇÃO =============

function normalizarDataNascimento(data: string | null | undefined): string | null {
  if (!data) return null;
  const limpo = data.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpo)) return limpo;
  if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(limpo)) {
    const [dia, mes, ano] = limpo.split(/[\/\-]/);
    return `${ano}-${mes}-${dia}`;
  }
  return null;
}

function normalizarTelefone(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  return telefone.replace(/\D/g, '');
}

function formatarConvenioParaBanco(convenio: string): string {
  return convenio.toUpperCase().trim();
}

function formatarDataPorExtenso(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

// ============= FUNÇÃO DE BUSCA DE MÉDICO =============

async function buscarMedico(supabase: any, identificador: string) {
  const nomeNormalizado = identificador.toLowerCase().trim();
  
  // Buscar por nome parcial
  const { data: medicos, error } = await supabase
    .from('medicos')
    .select('*')
    .eq('cliente_id', CLINICA_VENUS_ID)
    .eq('ativo', true);

  if (error || !medicos || medicos.length === 0) {
    return null;
  }

  // Buscar match por nome
  for (const medico of medicos) {
    const nomeMedico = medico.nome.toLowerCase();
    if (nomeMedico.includes(nomeNormalizado) || 
        nomeNormalizado.includes('joao') && nomeMedico.includes('joao') ||
        nomeNormalizado.includes('joão') && nomeMedico.includes('joao') ||
        nomeNormalizado.includes('gabriela') && nomeMedico.includes('gabriela') ||
        nomeNormalizado.includes('cardiolog') && nomeMedico.includes('joao') ||
        nomeNormalizado.includes('gastro') && nomeMedico.includes('gabriela')) {
      return medico;
    }
  }

  return null;
}

// ============= HANDLER DE DISPONIBILIDADE =============

async function handleAvailability(supabase: any, body: any) {
  const { 
    medico_nome,
    medico_id,
    atendimento_nome,
    data_consulta,
    periodo: periodoPreferido,
    quantidade_dias = 14
  } = body;

  console.log('📥 [AVAILABILITY] Parâmetros:', { medico_nome, atendimento_nome, data_consulta, periodoPreferido });

  // Buscar médico
  let medico;
  if (medico_id) {
    const { data } = await supabase
      .from('medicos')
      .select('*')
      .eq('id', medico_id)
      .eq('cliente_id', CLINICA_VENUS_ID)
      .single();
    medico = data;
  } else if (medico_nome) {
    medico = await buscarMedico(supabase, medico_nome);
  }

  if (!medico) {
    return businessErrorResponse({
      codigo_erro: 'MEDICO_NAO_ENCONTRADO',
      mensagem_usuario: `Médico não encontrado. Médicos disponíveis na Clínica Vênus:\n\n• Dr. João Silva - Cardiologista\n• Dra. Gabriela Batista - Gastroenterologista\n\n📞 Contato: ${CLINIC_INFO.whatsapp}`,
      medicos_disponiveis: ['Dr. João Silva', 'Dra. Gabriela Batista']
    });
  }

  // Verificar regras de negócio do médico
  const regras = BUSINESS_RULES_VENUS.medicos[medico.id];
  if (!regras) {
    return businessErrorResponse({
      codigo_erro: 'MEDICO_SEM_REGRAS',
      mensagem_usuario: `${medico.nome} não tem agenda online configurada. Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  // Identificar serviço
  let servicoKey = Object.keys(regras.servicos)[0]; // Default: primeiro serviço
  if (atendimento_nome) {
    const nomeNorm = atendimento_nome.toLowerCase();
    for (const [key, servico] of Object.entries(regras.servicos)) {
      if (key.toLowerCase().includes(nomeNorm) || nomeNorm.includes(key.toLowerCase().split(' ')[0])) {
        servicoKey = key;
        break;
      }
    }
  }

  const servico = regras.servicos[servicoKey];
  const tipoAtendimento = servico.tipo;
  const dataAtual = getDataAtualBrasil();

  // Buscar próximas datas disponíveis
  const proximasDatas = [];
  let dataBase = data_consulta || dataAtual;
  let diasBuscados = 0;

  while (proximasDatas.length < 5 && diasBuscados < quantidade_dias) {
    const [ano, mes, dia] = dataBase.split('-').map(Number);
    const dataObj = new Date(ano, mes - 1, dia);
    dataObj.setDate(dataObj.getDate() + (diasBuscados === 0 && !data_consulta ? 0 : diasBuscados));
    
    const dataStr = dataObj.toISOString().split('T')[0];
    const diaSemana = dataObj.getDay();
    
    // Verificar se o médico atende neste dia
    if (servico.dias_semana.includes(diaSemana)) {
      // Verificar bloqueios
      const { data: bloqueios } = await supabase
        .from('bloqueios_agenda')
        .select('id')
        .eq('medico_id', medico.id)
        .eq('cliente_id', CLINICA_VENUS_ID)
        .eq('status', 'ativo')
        .lte('data_inicio', dataStr)
        .gte('data_fim', dataStr);

      if (!bloqueios || bloqueios.length === 0) {
        // Verificar vagas disponíveis
        for (const [periodo, config] of Object.entries(servico.periodos)) {
          if ((config as any).dias_especificos && !(config as any).dias_especificos.includes(diaSemana)) {
            continue;
          }

          // Contar agendamentos existentes
          const { count } = await supabase
            .from('agendamentos')
            .select('*', { count: 'exact', head: true })
            .eq('medico_id', medico.id)
            .eq('data_agendamento', dataStr)
            .eq('cliente_id', CLINICA_VENUS_ID)
            .is('excluido_em', null)
            .in('status', ['agendado', 'confirmado']);

          const limite = (config as any).limite || 20;
          const vagasDisponiveis = limite - (count || 0);

          if (vagasDisponiveis > 0) {
            proximasDatas.push({
              data: formatarDataPorExtenso(dataStr),
              data_iso: dataStr,
              dia_semana: diasNomes[diaSemana],
              periodo: periodo.includes('manha') ? 'Manhã' : (periodo.includes('tarde') ? 'Tarde' : 'Integral'),
              horario_distribuicao: (config as any).distribuicao_fichas || `${(config as any).inicio} às ${(config as any).fim}`,
              vagas_disponiveis: vagasDisponiveis,
              tipo_atendimento: tipoAtendimento
            });
            break;
          }
        }
      }
    }
    
    diasBuscados++;
    dataBase = dataAtual;
  }

  if (proximasDatas.length === 0) {
    return businessErrorResponse({
      codigo_erro: 'SEM_DISPONIBILIDADE',
      mensagem_usuario: `Não encontramos vagas para ${regras.nome} nos próximos ${quantidade_dias} dias.\n\n📞 Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  // Montar mensagem
  let mensagem = `✅ ${regras.nome} - ${servicoKey}\n\n`;
  mensagem += `📅 Próximas datas disponíveis:\n\n`;
  
  proximasDatas.forEach((d: any) => {
    mensagem += `• ${d.dia_semana}, ${d.data}\n`;
    mensagem += `  Período: ${d.horario_distribuicao}\n`;
    mensagem += `  Vagas: ${d.vagas_disponiveis}\n\n`;
  });

  if (tipoAtendimento === 'ordem_chegada') {
    mensagem += `⚠️ ORDEM DE CHEGADA: Compareça no horário indicado para pegar ficha.\n`;
  }

  if (servico.valor) {
    mensagem += `\n💰 Valor: R$ ${servico.valor.toFixed(2)}`;
    if (servico.retorno_gratuito_dias) {
      mensagem += ` (retorno gratuito em até ${servico.retorno_gratuito_dias} dias)`;
    }
    mensagem += '\n';
  }

  mensagem += `\n💬 Qual data funciona melhor para você?`;

  return successResponse({
    disponivel: true,
    tipo_agendamento: tipoAtendimento,
    medico: regras.nome,
    especialidade: regras.especialidade,
    servico: servicoKey,
    proximas_datas: proximasDatas,
    valor: servico.valor,
    convenios_aceitos: servico.convenios_aceitos,
    mensagem_whatsapp: mensagem,
    message: mensagem
  });
}

// ============= HANDLER DE AGENDAMENTO =============

async function handleSchedule(supabase: any, body: any) {
  const {
    paciente_nome,
    data_nascimento,
    convenio,
    telefone,
    celular,
    medico_nome,
    medico_id,
    atendimento_nome,
    atendimento_id,
    data_consulta,
    hora_consulta,
    observacoes
  } = body;

  console.log('📥 [SCHEDULE] Parâmetros:', { paciente_nome, medico_nome, data_consulta, hora_consulta });

  // Validações básicas
  if (!paciente_nome) {
    return businessErrorResponse({
      codigo_erro: 'DADOS_INCOMPLETOS',
      mensagem_usuario: 'Nome do paciente é obrigatório.'
    });
  }

  // Buscar médico
  let medico;
  if (medico_id) {
    const { data } = await supabase
      .from('medicos')
      .select('*')
      .eq('id', medico_id)
      .eq('cliente_id', CLINICA_VENUS_ID)
      .single();
    medico = data;
  } else if (medico_nome) {
    medico = await buscarMedico(supabase, medico_nome);
  }

  if (!medico) {
    return businessErrorResponse({
      codigo_erro: 'MEDICO_NAO_ENCONTRADO',
      mensagem_usuario: `Médico não encontrado. Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  // Buscar atendimento
  let atendimento;
  if (atendimento_id) {
    const { data } = await supabase
      .from('atendimentos')
      .select('*')
      .eq('id', atendimento_id)
      .eq('cliente_id', CLINICA_VENUS_ID)
      .single();
    atendimento = data;
  } else if (atendimento_nome) {
    const { data } = await supabase
      .from('atendimentos')
      .select('*')
      .eq('cliente_id', CLINICA_VENUS_ID)
      .eq('medico_id', medico.id)
      .ilike('nome', `%${atendimento_nome}%`)
      .single();
    atendimento = data;
  } else {
    // Pegar primeiro atendimento do médico
    const { data } = await supabase
      .from('atendimentos')
      .select('*')
      .eq('cliente_id', CLINICA_VENUS_ID)
      .eq('medico_id', medico.id)
      .eq('ativo', true)
      .limit(1)
      .single();
    atendimento = data;
  }

  if (!atendimento) {
    return businessErrorResponse({
      codigo_erro: 'ATENDIMENTO_NAO_ENCONTRADO',
      mensagem_usuario: `Tipo de atendimento não encontrado para ${medico.nome}. Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  // Chamar RPC de agendamento
  const { data: resultado, error } = await supabase.rpc('criar_agendamento_atomico_externo', {
    p_cliente_id: CLINICA_VENUS_ID,
    p_nome_completo: paciente_nome.toUpperCase().trim(),
    p_data_nascimento: normalizarDataNascimento(data_nascimento) || '1990-01-01',
    p_convenio: formatarConvenioParaBanco(convenio || 'PARTICULAR'),
    p_telefone: normalizarTelefone(telefone) || '',
    p_celular: normalizarTelefone(celular) || normalizarTelefone(telefone) || '',
    p_medico_id: medico.id,
    p_atendimento_id: atendimento.id,
    p_data_agendamento: data_consulta,
    p_hora_agendamento: hora_consulta || '08:00:00',
    p_observacoes: observacoes || '',
    p_criado_por: 'whatsapp_bot_venus'
  });

  if (error) {
    console.error('❌ Erro RPC:', error);
    return businessErrorResponse({
      codigo_erro: 'ERRO_AGENDAMENTO',
      mensagem_usuario: `Não foi possível criar o agendamento: ${error.message}\n\n📞 Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  if (!resultado?.success) {
    return businessErrorResponse({
      codigo_erro: resultado?.error || 'ERRO_AGENDAMENTO',
      mensagem_usuario: resultado?.message || `Erro ao criar agendamento. Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  // Montar mensagem de sucesso
  const regras = BUSINESS_RULES_VENUS.medicos[medico.id];
  const tipoAtendimento = regras?.tipo_agendamento || 'hora_marcada';

  let mensagem = `✅ AGENDAMENTO CONFIRMADO!\n\n`;
  mensagem += `👤 Paciente: ${paciente_nome.toUpperCase()}\n`;
  mensagem += `👨‍⚕️ Médico: ${medico.nome}\n`;
  mensagem += `📋 Atendimento: ${atendimento.nome}\n`;
  mensagem += `📅 Data: ${formatarDataPorExtenso(data_consulta)}\n`;
  
  if (tipoAtendimento === 'hora_marcada') {
    mensagem += `⏰ Horário: ${hora_consulta}\n`;
  } else {
    mensagem += `⏰ Chegue no período indicado para pegar ficha\n`;
  }

  mensagem += `\n📍 Local: ${CLINIC_INFO.endereco}\n`;
  mensagem += `📞 Contato: ${CLINIC_INFO.whatsapp}\n`;

  return successResponse({
    agendamento_id: resultado.agendamento_id,
    paciente_id: resultado.paciente_id,
    mensagem_whatsapp: mensagem,
    message: mensagem
  });
}

// ============= HANDLER DE VERIFICAR PACIENTE =============

async function handleCheckPatient(supabase: any, body: any) {
  const { paciente_nome, data_nascimento, celular } = body;

  console.log('📥 [CHECK-PATIENT] Parâmetros:', { paciente_nome, data_nascimento, celular });

  // Buscar agendamentos do paciente
  let query = supabase
    .from('agendamentos')
    .select(`
      *,
      pacientes!inner(nome_completo, data_nascimento, celular, convenio),
      medicos(nome, especialidade),
      atendimentos(nome, tipo)
    `)
    .eq('cliente_id', CLINICA_VENUS_ID)
    .is('excluido_em', null)
    .in('status', ['agendado', 'confirmado'])
    .order('data_agendamento', { ascending: true });

  if (paciente_nome) {
    query = query.ilike('pacientes.nome_completo', `%${paciente_nome}%`);
  }
  if (celular) {
    const celularNorm = normalizarTelefone(celular);
    query = query.ilike('pacientes.celular', `%${celularNorm}%`);
  }

  const { data: agendamentos, error } = await query;

  if (error) {
    console.error('❌ Erro ao buscar:', error);
    return businessErrorResponse({
      codigo_erro: 'ERRO_BUSCA',
      mensagem_usuario: `Erro ao buscar agendamentos. Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  if (!agendamentos || agendamentos.length === 0) {
    return successResponse({
      encontrado: false,
      mensagem_whatsapp: `Não encontrei agendamentos para este paciente na Clínica Vênus.\n\n📞 Para agendar: ${CLINIC_INFO.whatsapp}`,
      message: 'Nenhum agendamento encontrado'
    });
  }

  let mensagem = `📋 Agendamentos encontrados:\n\n`;
  agendamentos.forEach((ag: any, i: number) => {
    mensagem += `${i + 1}. ${ag.medicos?.nome || 'Médico'}\n`;
    mensagem += `   📅 ${formatarDataPorExtenso(ag.data_agendamento)} às ${ag.hora_agendamento}\n`;
    mensagem += `   📋 ${ag.atendimentos?.nome || 'Consulta'}\n`;
    mensagem += `   ✅ Status: ${ag.status === 'confirmado' ? 'Confirmado' : 'Agendado'}\n\n`;
  });

  mensagem += `📍 ${CLINIC_INFO.endereco}`;

  return successResponse({
    encontrado: true,
    agendamentos: agendamentos.map((ag: any) => ({
      id: ag.id,
      data: ag.data_agendamento,
      hora: ag.hora_agendamento,
      medico: ag.medicos?.nome,
      atendimento: ag.atendimentos?.nome,
      status: ag.status
    })),
    mensagem_whatsapp: mensagem,
    message: mensagem
  });
}

// ============= HANDLER DE CANCELAMENTO =============

async function handleCancel(supabase: any, body: any) {
  const { agendamento_id, paciente_nome, celular, motivo } = body;

  console.log('📥 [CANCEL] Parâmetros:', { agendamento_id, paciente_nome });

  let agendamentoId = agendamento_id;

  // Se não tem ID, buscar pelo paciente
  if (!agendamentoId && (paciente_nome || celular)) {
    let query = supabase
      .from('agendamentos')
      .select('id, pacientes!inner(nome_completo, celular)')
      .eq('cliente_id', CLINICA_VENUS_ID)
      .is('excluido_em', null)
      .in('status', ['agendado', 'confirmado'])
      .order('data_agendamento', { ascending: true })
      .limit(1);

    if (paciente_nome) {
      query = query.ilike('pacientes.nome_completo', `%${paciente_nome}%`);
    }
    if (celular) {
      query = query.ilike('pacientes.celular', `%${normalizarTelefone(celular)}%`);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      agendamentoId = data[0].id;
    }
  }

  if (!agendamentoId) {
    return businessErrorResponse({
      codigo_erro: 'AGENDAMENTO_NAO_ENCONTRADO',
      mensagem_usuario: `Não encontrei agendamento para cancelar.\n\n📞 Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  // Cancelar via RPC
  const { data: resultado, error } = await supabase.rpc('cancelar_agendamento_soft', {
    p_agendamento_id: agendamentoId,
    p_cancelado_por: 'whatsapp_bot_venus'
  });

  if (error || !resultado?.success) {
    return businessErrorResponse({
      codigo_erro: 'ERRO_CANCELAMENTO',
      mensagem_usuario: `Não foi possível cancelar: ${error?.message || resultado?.error}\n\n📞 Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  return successResponse({
    agendamento_id: agendamentoId,
    mensagem_whatsapp: `✅ Agendamento cancelado com sucesso!\n\nSe precisar reagendar:\n📞 ${CLINIC_INFO.whatsapp}`,
    message: 'Agendamento cancelado'
  });
}

// ============= HANDLER DE CONFIRMAÇÃO =============

async function handleConfirm(supabase: any, body: any) {
  const { agendamento_id, paciente_nome, celular } = body;

  console.log('📥 [CONFIRM] Parâmetros:', { agendamento_id, paciente_nome });

  let agendamentoId = agendamento_id;

  if (!agendamentoId && (paciente_nome || celular)) {
    let query = supabase
      .from('agendamentos')
      .select('id, pacientes!inner(nome_completo, celular)')
      .eq('cliente_id', CLINICA_VENUS_ID)
      .is('excluido_em', null)
      .eq('status', 'agendado')
      .order('data_agendamento', { ascending: true })
      .limit(1);

    if (paciente_nome) {
      query = query.ilike('pacientes.nome_completo', `%${paciente_nome}%`);
    }
    if (celular) {
      query = query.ilike('pacientes.celular', `%${normalizarTelefone(celular)}%`);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      agendamentoId = data[0].id;
    }
  }

  if (!agendamentoId) {
    return businessErrorResponse({
      codigo_erro: 'AGENDAMENTO_NAO_ENCONTRADO',
      mensagem_usuario: `Não encontrei agendamento para confirmar.\n\n📞 Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  const { data: resultado, error } = await supabase.rpc('confirmar_agendamento', {
    p_agendamento_id: agendamentoId,
    p_confirmado_por: 'whatsapp_bot_venus'
  });

  if (error || !resultado?.success) {
    return businessErrorResponse({
      codigo_erro: 'ERRO_CONFIRMACAO',
      mensagem_usuario: `Não foi possível confirmar: ${error?.message || resultado?.error}\n\n📞 Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  return successResponse({
    agendamento_id: agendamentoId,
    mensagem_whatsapp: `✅ Presença confirmada!\n\nAguardamos você na data marcada.\n\n📍 ${CLINIC_INFO.endereco}`,
    message: 'Agendamento confirmado'
  });
}

// ============= HANDLER DE LISTAR MÉDICOS =============

async function handleListDoctors(supabase: any) {
  const { data: medicos, error } = await supabase
    .from('medicos')
    .select('id, nome, especialidade, convenios_aceitos')
    .eq('cliente_id', CLINICA_VENUS_ID)
    .eq('ativo', true);

  if (error) {
    return businessErrorResponse({
      codigo_erro: 'ERRO_BUSCA',
      mensagem_usuario: `Erro ao buscar médicos. Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  let mensagem = `👨‍⚕️ MÉDICOS DA CLÍNICA VÊNUS:\n\n`;
  
  medicos?.forEach((m: any) => {
    const regras = BUSINESS_RULES_VENUS.medicos[m.id];
    mensagem += `• ${m.nome}\n`;
    mensagem += `  ${m.especialidade}\n`;
    if (regras) {
      mensagem += `  Tipo: ${regras.tipo_agendamento === 'hora_marcada' ? 'Hora Marcada' : 'Ordem de Chegada'}\n`;
      const servicos = Object.keys(regras.servicos).join(', ');
      mensagem += `  Serviços: ${servicos}\n`;
    }
    mensagem += '\n';
  });

  mensagem += `📍 ${CLINIC_INFO.endereco}\n`;
  mensagem += `📞 ${CLINIC_INFO.whatsapp}\n`;
  mensagem += `⏰ ${CLINIC_INFO.horario_funcionamento}`;

  return successResponse({
    medicos: medicos?.map((m: any) => ({
      id: m.id,
      nome: m.nome,
      especialidade: m.especialidade,
      convenios: m.convenios_aceitos
    })),
    mensagem_whatsapp: mensagem,
    message: mensagem
  });
}

// ============= MAIN HANDLER =============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const action = pathSegments[pathSegments.length - 1];

    console.log(`\n🏥 [CLÍNICA VÊNUS] Ação: ${action}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = req.method === 'POST' ? await req.json() : {};

    switch (action) {
      case 'availability':
        return await handleAvailability(supabase, body);
      
      case 'schedule':
        return await handleSchedule(supabase, body);
      
      case 'check-patient':
        return await handleCheckPatient(supabase, body);
      
      case 'cancel':
        return await handleCancel(supabase, body);
      
      case 'confirm':
        return await handleConfirm(supabase, body);
      
      case 'list-doctors':
      case 'doctors':
        return await handleListDoctors(supabase);
      
      case 'clinic-info':
        return successResponse({
          clinica: CLINIC_INFO,
          message: `🏥 ${CLINIC_INFO.nome}\n📍 ${CLINIC_INFO.endereco}\n📞 ${CLINIC_INFO.whatsapp}\n⏰ ${CLINIC_INFO.horario_funcionamento}`
        });

      default:
        return businessErrorResponse({
          codigo_erro: 'ACAO_INVALIDA',
          mensagem_usuario: `Ação "${action}" não reconhecida.\n\nAções disponíveis:\n• availability - Verificar disponibilidade\n• schedule - Agendar consulta\n• check-patient - Verificar agendamentos\n• cancel - Cancelar agendamento\n• confirm - Confirmar presença\n• list-doctors - Listar médicos\n• clinic-info - Informações da clínica`
        });
    }

  } catch (error: any) {
    console.error('❌ [ERRO CRÍTICO]:', error);
    return businessErrorResponse({
      codigo_erro: 'ERRO_SISTEMA',
      mensagem_usuario: `Ocorreu um erro. Entre em contato: ${CLINIC_INFO.whatsapp}`,
      detalhes: error?.message
    });
  }
});
