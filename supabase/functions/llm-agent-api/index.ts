import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

// Manter compatibilidade - retorna apenas a data
function getDataAtualBrasil(): string {
  return getDataHoraAtualBrasil().data;
}

// Regras de negócio para agendamento via LLM Agent (N8N/WhatsApp)
// Sistema web NÃO usa essas regras - funciona sem restrições
const BUSINESS_RULES = {
  medicos: {
    // Dr. Marcelo D'Carli - Cardiologista - ORDEM DE CHEGADA
    '1e110923-50df-46ff-a57a-29d88e372900': {
      nome: 'DR. MARCELO D\'CARLI',
      tipo_agendamento: 'ordem_chegada',
      servicos: {
        'Consulta Cardiológica': {
          permite_online: true,
          tipo: 'ordem_chegada',
          dias_semana: [1, 2, 3, 4, 5], // seg-sex
          periodos: {
            manha: { inicio: '07:30', fim: '10:00', limite: 9, distribuicao_fichas: '07:30 às 10:00' },
            tarde: { inicio: '13:30', fim: '15:00', limite: 9, dias_especificos: [1, 3], distribuicao_fichas: '13:30 às 15:00' } // seg e qua
          }
        },
        'Teste Ergométrico': {
          permite_online: true,
          tipo: 'ordem_chegada',
          dias_semana: [2, 3, 4], // ter, qua, qui
          periodos: {
            manha: { inicio: '07:30', fim: '10:00', limite: 8, dias_especificos: [3], distribuicao_fichas: '07:30 às 10:00' }, // qua
            tarde: { inicio: '13:30', fim: '15:00', limite: 8, dias_especificos: [2, 4], distribuicao_fichas: '13:30 às 15:00' } // ter e qui
          }
        },
        'ECG': {
          permite_online: false,
          mensagem: 'O ECG de rotina não precisa de agendamento. Compareça à clínica de segunda a sexta (8h-10h) ou quarta à tarde (14h-15h), por ordem de chegada.'
        }
      }
    },
    
    // Dra. Adriana Carla de Sena - Endocrinologista - ORDEM DE CHEGADA
    '32d30887-b876-4502-bf04-e55d7fb55b50': {
      nome: 'DRA. ADRIANA CARLA DE SENA',
      tipo_agendamento: 'ordem_chegada',
      idade_minima: 18,
      servicos: {
        'Consulta Endocrinológica': {
          permite_online: true,
          tipo: 'ordem_chegada',
          dias_semana: [1, 2, 3, 4, 5],
          periodos: {
            manha: { inicio: '08:00', fim: '10:00', limite: 9, atendimento_inicio: '08:45', distribuicao_fichas: '08:00 às 10:00' },
            tarde: { inicio: '13:00', fim: '15:00', limite: 9, dias_especificos: [2, 3], atendimento_inicio: '14:45', distribuicao_fichas: '13:00 às 15:00' }
          }
        }
      }
    },
    
    // Dr. Pedro Francisco - Ultrassonografista - HORA MARCADA
    '66e9310d-34cd-4005-8937-74e87125dc03': {
      nome: 'DR. PEDRO FRANCISCO',
      tipo_agendamento: 'hora_marcada',
      servicos: {
        'Consulta': {
          permite_online: true,
          tipo: 'hora_marcada',
          dias_semana: [2, 4], // ter e qui apenas
          periodos: {
            manha: { inicio: '09:30', fim: '10:00', limite: 4, atendimento_inicio: '10:00', intervalo_minutos: 30 }
          },
          mensagem_extra: 'Chegue entre 9h30 e 10h. O atendimento é após os exames, por ordem de chegada.'
        }
      }
    },
    
    // Dr. Alessandro Dias - Cardiologista (Ecocardiograma) - ORDEM DE CHEGADA
    'c192e08e-e216-4c22-99bf-b5992ce05e17': {
      nome: 'DR. ALESSANDRO DIAS',
      tipo_agendamento: 'ordem_chegada',
      servicos: {
        'Ecocardiograma': {
          permite_online: true,
          tipo: 'ordem_chegada',
          dias_semana: [1], // apenas segunda
          periodos: {
            manha: { inicio: '08:00', fim: '09:00', limite: 9, distribuicao_fichas: '08:00 às 09:00' }
          }
        },
        'Consulta Cardiológica': {
          permite_online: false,
          mensagem: 'Para consultas e retornos com Dr. Alessandro Dias, agende por telefone: (87) 3866-4050'
        }
      }
    }
  }
};

// Função auxiliar para calcular idade
function calcularIdade(dataNascimento: string): number {
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
}

// Função auxiliar para obter dia da semana (0=dom, 1=seg, ...)
function getDiaSemana(data: string): number {
  return new Date(data).getDay();
}

// Função para mapear dados flexivelmente
function mapSchedulingData(body: any) {
  const mapped = {
    // Nome do paciente - aceitar diferentes formatos
    paciente_nome: body.paciente_nome || body.nome_paciente || body.nome_completo || body.patient_name,
    
    // Data de nascimento - aceitar diferentes formatos
    data_nascimento: body.data_nascimento || body.paciente_nascimento || body.birth_date || body.nascimento,
    
    // Convênio
    convenio: body.convenio || body.insurance || body.plano_saude,
    
    // Telefones
    telefone: body.telefone || body.phone || body.telefone_fixo,
    celular: body.celular || body.mobile || body.whatsapp || body.telefone_celular,
    
    // Médico - aceitar ID ou nome
    medico_nome: body.medico_nome || body.doctor_name || body.nome_medico,
    medico_id: body.medico_id || body.doctor_id,
    
    // Atendimento
    atendimento_nome: body.atendimento_nome || body.tipo_consulta || body.service_name || body.procedimento,
    
    // Data e hora da consulta - aceitar diferentes formatos
    data_consulta: body.data_consulta || body.data_agendamento || body.appointment_date || body.data,
    hora_consulta: body.hora_consulta || body.hora_agendamento || body.appointment_time || body.hora,
    
    // Observações
    observacoes: body.observacoes || body.notes || body.comments || body.obs
  };
  
  return mapped;
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

    // 🔑 Buscar cliente_id do IPADO
  // Cliente ID fixo do IPADO (sistema single-tenant)
  const CLIENTE_ID = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';
  console.log('🏥 Sistema configurado para cliente IPADO:', CLIENTE_ID);

    const url = new URL(req.url);
    const method = req.method;
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    console.log(`🤖 LLM Agent API Call: ${method} ${url.pathname}`);

    if (method === 'POST') {
      const body = await req.json();
      const action = pathParts[1]; // /llm-agent-api/{action}

      switch (action) {
        case 'schedule':
          return await handleSchedule(supabase, body, CLIENTE_ID);
        case 'check-patient':
          return await handleCheckPatient(supabase, body, CLIENTE_ID);
        case 'reschedule':
          return await handleReschedule(supabase, body, CLIENTE_ID);
        case 'cancel':
          return await handleCancel(supabase, body, CLIENTE_ID);
        case 'availability':
          return await handleAvailability(supabase, body, CLIENTE_ID);
        case 'patient-search':
          return await handlePatientSearch(supabase, body, CLIENTE_ID);
        default:
          return errorResponse('Ação não reconhecida. Ações disponíveis: schedule, check-patient, reschedule, cancel, availability, patient-search');
      }
    }

    return errorResponse('Método não permitido. Use POST.');

  } catch (error: any) {
    console.error('❌ Erro na LLM Agent API:', error);
    return errorResponse(`Erro interno: ${error?.message || 'Erro desconhecido'}`);
  }
})

// Agendar consulta
async function handleSchedule(supabase: any, body: any, clienteId: string) {
  try {
    console.log('📥 Dados recebidos na API:', JSON.stringify(body, null, 2));
    
    // 🛡️ SANITIZAÇÃO AUTOMÁTICA: Remover "=" do início dos valores (problema comum do N8N)
    const sanitizeValue = (value: any): any => {
      if (typeof value === 'string' && value.startsWith('=')) {
        const cleaned = value.substring(1);
        console.log(`🧹 Sanitizado: "${value}" → "${cleaned}"`);
        return cleaned;
      }
      return value;
    };
    
    // Sanitizar todos os campos do body antes do mapeamento
    const sanitizedBody = Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, sanitizeValue(value)])
    );
    
    // Mapear dados flexivelmente (aceitar diferentes formatos)
    const mappedData = mapSchedulingData(sanitizedBody);
    console.log('🔄 Dados mapeados:', JSON.stringify(mappedData, null, 2));
    
    const { 
      paciente_nome, 
      data_nascimento, 
      convenio, 
      telefone, 
      celular, 
      medico_nome, 
      medico_id,
      atendimento_nome, 
      data_consulta, 
      hora_consulta, 
      observacoes 
    } = mappedData;

    // Validar campos obrigatórios
    if (!paciente_nome || !data_nascimento || !convenio || !celular || (!medico_nome && !medico_id) || !data_consulta || !hora_consulta) {
      const missingFields = [];
      if (!paciente_nome) missingFields.push('paciente_nome');
      if (!data_nascimento) missingFields.push('data_nascimento');
      if (!convenio) missingFields.push('convenio');
      if (!celular) missingFields.push('celular');
      if (!medico_nome && !medico_id) missingFields.push('medico_nome ou medico_id');
      if (!data_consulta) missingFields.push('data_consulta');
      if (!hora_consulta) missingFields.push('hora_consulta');
      
      return errorResponse(`Campos obrigatórios faltando: ${missingFields.join(', ')}`);
    }

    // Buscar médico por ID ou nome (COM filtro de cliente)
    let medico;
    if (medico_id) {
      const { data, error } = await supabase
        .from('medicos')
        .select('id, nome, ativo')
        .eq('id', medico_id)
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .single();
      
      medico = data;
      if (error || !medico) {
        return errorResponse(`Médico com ID "${medico_id}" não encontrado ou inativo`);
      }
    } else {
      const { data, error } = await supabase
        .from('medicos')
        .select('id, nome, ativo')
        .ilike('nome', `%${medico_nome}%`)
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .single();
      
      medico = data;
      if (error || !medico) {
        return errorResponse(`Médico "${medico_nome}" não encontrado ou inativo`);
      }
    }

    // ===== VALIDAÇÕES DE REGRAS DE NEGÓCIO (APENAS PARA N8N) =====
    const regras = BUSINESS_RULES.medicos[medico.id];
    
    if (regras) {
      console.log(`🔍 Aplicando regras de negócio para ${regras.nome}`);
      
      // 1. Validar idade mínima
      if (regras.idade_minima) {
        const idade = calcularIdade(data_nascimento);
        if (idade < regras.idade_minima) {
          return errorResponse(
            `${regras.nome} atende apenas pacientes com ${regras.idade_minima}+ anos. Idade informada: ${idade} anos.`
          );
        }
        console.log(`✅ Validação de idade OK: ${idade} anos`);
      }
      
      // 2. Validar serviço específico
      if (atendimento_nome && regras.servicos) {
        const servicoKey = Object.keys(regras.servicos).find(s => 
          s.toLowerCase().includes(atendimento_nome.toLowerCase()) ||
          atendimento_nome.toLowerCase().includes(s.toLowerCase())
        );
        
        if (servicoKey) {
          const servico = regras.servicos[servicoKey];
          console.log(`🔍 Validando serviço: ${servicoKey}`);
          
          // 2.1 Verificar se permite agendamento online
          if (!servico.permite_online) {
            console.log(`❌ Serviço ${servicoKey} não permite agendamento online`);
            return errorResponse(servico.mensagem || 'Este serviço não pode ser agendado online.');
          }
          
          // 2.2 Verificar dia da semana
          const diaSemana = getDiaSemana(data_consulta);
          if (servico.dias_semana && !servico.dias_semana.includes(diaSemana)) {
            const diasNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
            const diasPermitidos = servico.dias_semana.map((d: number) => diasNomes[d]).join(', ');
            console.log(`❌ Dia da semana inválido: ${diasNomes[diaSemana]} não está em [${diasPermitidos}]`);
            return errorResponse(
              `${regras.nome} não atende ${servicoKey} no dia escolhido. Dias disponíveis: ${diasPermitidos}`
            );
          }
          console.log(`✅ Dia da semana válido`);
          
          // 2.3 Verificar período e limite de vagas
          if (servico.periodos) {
            const hora = parseInt(hora_consulta.split(':')[0]);
            const periodo = hora < 12 ? 'manha' : 'tarde';
            const configPeriodo = servico.periodos[periodo];
            
            if (!configPeriodo) {
              console.log(`❌ Período ${periodo} não disponível para este serviço`);
              return errorResponse(
                `${regras.nome} não atende ${servicoKey} no período da ${periodo === 'manha' ? 'manhã' : 'tarde'}`
              );
            }
            
            // Verificar dias específicos do período (ex: tarde só ter e qui)
            if (configPeriodo.dias_especificos && !configPeriodo.dias_especificos.includes(diaSemana)) {
              const diasNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
              const diasPermitidos = configPeriodo.dias_especificos.map((d: number) => diasNomes[d]).join(', ');
              console.log(`❌ Período ${periodo} não disponível neste dia da semana`);
              return errorResponse(
                `${regras.nome} não atende ${servicoKey} no período da ${periodo === 'manha' ? 'manhã' : 'tarde'} no dia escolhido. Dias disponíveis para este período: ${diasPermitidos}`
              );
            }
            
            // Verificar limite de vagas
            if (configPeriodo.limite) {
              // Contar agendamentos já existentes no período
              const horaInicio = periodo === 'manha' ? '00:00:00' : '12:00:00';
              const horaFim = periodo === 'manha' ? '12:00:00' : '23:59:59';
              
              const { data: agendamentosExistentes } = await supabase
                .from('agendamentos')
                .select('id')
                .eq('medico_id', medico.id)
                .eq('data_agendamento', data_consulta)
                .eq('cliente_id', clienteId)
                .gte('hora_agendamento', horaInicio)
                .lt('hora_agendamento', horaFim)
                .in('status', ['agendado', 'confirmado']);
              
              const vagasOcupadas = agendamentosExistentes?.length || 0;
              console.log(`📊 Vagas ocupadas: ${vagasOcupadas}/${configPeriodo.limite}`);
              
              if (vagasOcupadas >= configPeriodo.limite) {
                console.log(`❌ Limite de vagas atingido`);
                return errorResponse(
                  `Não há mais vagas disponíveis para ${regras.nome} - ${servicoKey} neste período. Limite: ${configPeriodo.limite} pacientes, Ocupado: ${vagasOcupadas}`
                );
              }
              console.log(`✅ Vagas disponíveis: ${configPeriodo.limite - vagasOcupadas}`);
            }
          }
        }
      }
    }

    // Buscar atendimento por nome (se especificado) COM filtro de cliente
    let atendimento_id = null;
    if (atendimento_nome) {
      const { data: atendimento, error: atendimentoError } = await supabase
        .from('atendimentos')
        .select('id, nome')
        .ilike('nome', `%${atendimento_nome}%`)
        .eq('medico_id', medico.id)
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .single();

      if (atendimentoError || !atendimento) {
        return errorResponse(`Atendimento "${atendimento_nome}" não encontrado para o médico ${medico.nome}`);
      }
      atendimento_id = atendimento.id;
    } else {
      // Buscar primeiro atendimento disponível do médico COM filtro de cliente
      const { data: atendimentos } = await supabase
        .from('atendimentos')
        .select('id')
        .eq('medico_id', medico.id)
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .limit(1);

      if (!atendimentos || atendimentos.length === 0) {
        return errorResponse(`Nenhum atendimento disponível para o médico ${medico.nome}`);
      }
      atendimento_id = atendimentos[0].id;
    }

    // Criar agendamento usando a função atômica
    console.log(`📅 Criando agendamento para ${paciente_nome} com médico ${medico.nome}`);
    
    const { data: result, error: agendamentoError } = await supabase
      .rpc('criar_agendamento_atomico_externo', {
        p_cliente_id: clienteId,
        p_nome_completo: paciente_nome.toUpperCase(),
        p_data_nascimento: data_nascimento,
        p_convenio: convenio.toUpperCase(),
        p_telefone: telefone || null,
        p_celular: celular,
        p_medico_id: medico.id,
        p_atendimento_id: atendimento_id,
        p_data_agendamento: data_consulta,
        p_hora_agendamento: hora_consulta,
        p_observacoes: (observacoes || 'Agendamento via LLM Agent WhatsApp').toUpperCase(),
        p_criado_por: 'LLM Agent WhatsApp',
        p_force_conflict: false
      });

    console.log('📋 Resultado da função:', { result, agendamentoError });

    if (agendamentoError) {
      console.error('❌ Erro na função criar_agendamento_atomico:', agendamentoError);
      return errorResponse(`Erro ao agendar: ${agendamentoError.message}`);
    }

    if (!result?.success) {
      console.error('❌ Função retornou erro:', result);
      return errorResponse(`Erro ao agendar: ${result?.error || result?.message || 'Erro desconhecido'}`);
    }

    console.log('✅ Agendamento criado com sucesso:', result);

    return successResponse({
      message: `Consulta agendada com sucesso para ${paciente_nome}`,
      agendamento_id: result.agendamento_id,
      paciente_id: result.paciente_id,
      medico: medico.nome,
      data: data_consulta,
      hora: hora_consulta
    });

  } catch (error: any) {
    return errorResponse(`Erro ao processar agendamento: ${error?.message || 'Erro desconhecido'}`);
  }
}

// Verificar se paciente tem consultas agendadas
async function handleCheckPatient(supabase: any, body: any, clienteId: string) {
  try {
    const { paciente_nome, data_nascimento, celular } = body;

    if (!paciente_nome && !data_nascimento && !celular) {
      return errorResponse('Informe pelo menos: paciente_nome, data_nascimento ou celular para busca');
    }

    let query = supabase
      .from('agendamentos')
      .select(`
        id,
        data_agendamento,
        hora_agendamento,
        status,
        observacoes,
        pacientes(nome_completo, data_nascimento, celular, convenio),
        medicos(nome, especialidade),
        atendimentos(nome, tipo)
      `)
      .eq('cliente_id', clienteId)
      .in('status', ['agendado', 'confirmado'])
      .gte('data_agendamento', new Date().toISOString().split('T')[0])
      .order('data_agendamento', { ascending: true });

    // Buscar por nome do paciente COM filtro de cliente
    if (paciente_nome) {
      const { data: pacientes } = await supabase
        .from('pacientes')
        .select('id')
        .ilike('nome_completo', `%${paciente_nome}%`)
        .eq('cliente_id', clienteId);

      if (pacientes && pacientes.length > 0) {
        const paciente_ids = pacientes.map((p: any) => p.id);
        query = query.in('paciente_id', paciente_ids);
      }
    }

    const { data: agendamentos, error } = await query;

    if (error) {
      return errorResponse(`Erro ao buscar agendamentos: ${error.message}`);
    }

    // Filtrar por data de nascimento ou celular se fornecidos
    let filteredAgendamentos = agendamentos || [];
    
    if (data_nascimento) {
      filteredAgendamentos = filteredAgendamentos.filter((a: any) =>
        a.pacientes?.data_nascimento === data_nascimento
      );
    }

    if (celular) {
      filteredAgendamentos = filteredAgendamentos.filter((a: any) => 
        a.pacientes?.celular?.includes(celular.replace(/\D/g, ''))
      );
    }

    if (filteredAgendamentos.length === 0) {
      return successResponse({
        message: 'Nenhuma consulta encontrada para este paciente',
        consultas: [],
        total: 0
      });
    }

    const consultas = filteredAgendamentos.map((a: any) => ({
      id: a.id,
      paciente: a.pacientes?.nome_completo,
      medico: a.medicos?.nome,
      especialidade: a.medicos?.especialidade,
      atendimento: a.atendimentos?.nome,
      data: a.data_agendamento,
      hora: a.hora_agendamento,
      status: a.status,
      convenio: a.pacientes?.convenio,
      observacoes: a.observacoes
    }));

    return successResponse({
      message: `${consultas.length} consulta(s) encontrada(s)`,
      consultas,
      total: consultas.length
    });

  } catch (error: any) {
    return errorResponse(`Erro ao verificar paciente: ${error?.message || 'Erro desconhecido'}`);
  }
}

// Remarcar consulta
async function handleReschedule(supabase: any, body: any, clienteId: string) {
  try {
    const { agendamento_id, nova_data, nova_hora, observacoes } = body;

    if (!agendamento_id || !nova_data || !nova_hora) {
      return errorResponse('Campos obrigatórios: agendamento_id, nova_data, nova_hora');
    }

    // Verificar se agendamento existe COM filtro de cliente
    const { data: agendamento, error: checkError } = await supabase
      .from('agendamentos')
      .select(`
        id,
        medico_id,
        data_agendamento,
        hora_agendamento,
        status,
        pacientes(nome_completo),
        medicos(nome)
      `)
      .eq('id', agendamento_id)
      .eq('cliente_id', clienteId)
      .single();

    if (checkError || !agendamento) {
      return errorResponse('Agendamento não encontrado');
    }

    if (agendamento.status === 'cancelado') {
      return errorResponse('Não é possível remarcar consulta cancelada');
    }

    // Verificar disponibilidade do novo horário COM filtro de cliente
    const { data: conflitos } = await supabase
      .from('agendamentos')
      .select('id')
      .eq('medico_id', agendamento.medico_id)
      .eq('data_agendamento', nova_data)
      .eq('hora_agendamento', nova_hora)
      .eq('cliente_id', clienteId)
      .in('status', ['agendado', 'confirmado'])
      .neq('id', agendamento_id);

    if (conflitos && conflitos.length > 0) {
      return errorResponse('Horário já ocupado para este médico');
    }

    // Atualizar agendamento
    const updateData: any = {
      data_agendamento: nova_data,
      hora_agendamento: nova_hora,
      updated_at: new Date().toISOString()
    };

    if (observacoes) {
      updateData.observacoes = observacoes;
    }

    const { error: updateError } = await supabase
      .from('agendamentos')
      .update(updateData)
      .eq('id', agendamento_id);

    if (updateError) {
      return errorResponse(`Erro ao remarcar: ${updateError.message}`);
    }

    return successResponse({
      message: `Consulta remarcada com sucesso`,
      agendamento_id,
      paciente: agendamento.pacientes?.nome_completo,
      medico: agendamento.medicos?.nome,
      data_anterior: agendamento.data_agendamento,
      hora_anterior: agendamento.hora_agendamento,
      nova_data,
      nova_hora
    });

  } catch (error: any) {
    return errorResponse(`Erro ao remarcar consulta: ${error?.message || 'Erro desconhecido'}`);
  }
}

// Cancelar consulta
async function handleCancel(supabase: any, body: any, clienteId: string) {
  try {
    const { agendamento_id, motivo } = body;

    if (!agendamento_id) {
      return errorResponse('Campo obrigatório: agendamento_id');
    }

    // Verificar se agendamento existe COM filtro de cliente
    const { data: agendamento, error: checkError } = await supabase
      .from('agendamentos')
      .select(`
        id,
        status,
        data_agendamento,
        hora_agendamento,
        observacoes,
        pacientes(nome_completo),
        medicos(nome)
      `)
      .eq('id', agendamento_id)
      .eq('cliente_id', clienteId)
      .single();

    if (checkError || !agendamento) {
      return errorResponse('Agendamento não encontrado');
    }

    if (agendamento.status === 'cancelado') {
      return errorResponse('Consulta já está cancelada');
    }

    // Cancelar agendamento
    const observacoes_cancelamento = motivo 
      ? `${agendamento.observacoes || ''}\nCancelado via LLM Agent: ${motivo}`.trim()
      : `${agendamento.observacoes || ''}\nCancelado via LLM Agent`.trim();

    const { error: updateError } = await supabase
      .from('agendamentos')
      .update({
        status: 'cancelado',
        observacoes: observacoes_cancelamento,
        updated_at: new Date().toISOString()
      })
      .eq('id', agendamento_id);

    if (updateError) {
      return errorResponse(`Erro ao cancelar: ${updateError.message}`);
    }

    return successResponse({
      message: `Consulta cancelada com sucesso`,
      agendamento_id,
      paciente: agendamento.pacientes?.nome_completo,
      medico: agendamento.medicos?.nome,
      data: agendamento.data_agendamento,
      hora: agendamento.hora_agendamento,
      motivo
    });

  } catch (error: any) {
    return errorResponse(`Erro ao cancelar consulta: ${error?.message || 'Erro desconhecido'}`);
  }
}

// Verificar disponibilidade de horários
async function handleAvailability(supabase: any, body: any, clienteId: string) {
  try {
    console.log('📅 [RAW] Dados recebidos do N8N:', JSON.stringify(body, null, 2));
    
    // 🛡️ SANITIZAÇÃO AUTOMÁTICA: Remover "=" do início dos valores (problema comum do N8N)
    const sanitizeValue = (value: any): any => {
      if (typeof value === 'string' && value.startsWith('=')) {
        const cleaned = value.substring(1);
        console.log(`🧹 Sanitizado: "${value}" → "${cleaned}"`);
        return cleaned;
      }
      return value;
    };
    
    let { medico_nome, medico_id, data_consulta, atendimento_nome, dias_busca = 14, mensagem_original } = body;
    
    // 🆕 DETECÇÃO DE DADOS INVERTIDOS: Verificar se medico_nome contém data ou se data_consulta contém nome
    if (data_consulta && typeof data_consulta === 'string') {
      // Se data_consulta contém "|" ou nome de médico, está invertido
      if (data_consulta.includes('|') || /[a-zA-Z]{3,}/.test(data_consulta)) {
        console.warn('⚠️ DADOS INVERTIDOS DETECTADOS! Tentando corrigir...');
        console.log('Antes:', { medico_nome, atendimento_nome, data_consulta });
        
        // Tentar extrair informações do campo invertido
        const partes = data_consulta.split('|');
        if (partes.length === 2) {
          // Formato: "Dra Adriana|05/01/2026"
          const possivelMedico = partes[0].trim();
          const possivelData = partes[1].trim();
          
          // Realocar corretamente
          if (!medico_nome || medico_nome === 'Consulta') {
            medico_nome = possivelMedico;
          }
          
          // Converter data DD/MM/YYYY para YYYY-MM-DD
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(possivelData)) {
            const [dia, mes, ano] = possivelData.split('/');
            data_consulta = `${ano}-${mes}-${dia}`;
          }
        }
        
        console.log('Depois:', { medico_nome, atendimento_nome, data_consulta });
      }
    }
    
    // Aplicar sanitização
    medico_nome = sanitizeValue(medico_nome);
    medico_id = sanitizeValue(medico_id);
    atendimento_nome = sanitizeValue(atendimento_nome);
    data_consulta = sanitizeValue(data_consulta);
    
    // 🆕 CONVERTER FORMATO DE DATA: DD/MM/YYYY → YYYY-MM-DD
    if (data_consulta && /^\d{2}\/\d{2}\/\d{4}$/.test(data_consulta)) {
      const [dia, mes, ano] = data_consulta.split('/');
      data_consulta = `${ano}-${mes}-${dia}`;
      console.log(`📅 Data convertida: DD/MM/YYYY → YYYY-MM-DD: ${data_consulta}`);
    }
    
    // 📅 VALIDAÇÃO DE FORMATO
    if (data_consulta) {
      // Validar formato YYYY-MM-DD (após conversão)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data_consulta)) {
        return errorResponse(`Formato de data inválido: "${data_consulta}". Use YYYY-MM-DD (ex: 2026-01-20) ou DD/MM/YYYY (ex: 20/01/2026)`);
      }
    }
    
    // ✅ LÓGICA INTELIGENTE: Se for noite, buscar a partir de AMANHÃ
    const { data: dataAtual, hora: horaAtual, horarioEmMinutos: horarioAtualEmMinutos } = getDataHoraAtualBrasil();

    if (!data_consulta) {
      // Se for depois das 18h, começar a busca de AMANHÃ
      if (horaAtual >= 18) {
        const amanha = new Date(dataAtual + 'T00:00:00');
        amanha.setDate(amanha.getDate() + 1);
        data_consulta = amanha.toISOString().split('T')[0];
        console.log(`🌙 Horário noturno (${horaAtual}h). Buscando a partir de AMANHÃ: ${data_consulta}`);
      } else {
        data_consulta = dataAtual;
        console.log(`📅 Buscando a partir de HOJE: ${data_consulta} (${horaAtual}h)`);
      }
    } else {
      // Verificar se está no passado (comparar com data de São Paulo)
      const dataConsulta = new Date(data_consulta + 'T00:00:00');
      const hoje = new Date(dataAtual + 'T00:00:00');
      
      if (dataConsulta < hoje) {
        // Data no passado: se for horário noturno, já vai direto para AMANHÃ
        if (horaAtual >= 18) {
          const amanha = new Date(dataAtual + 'T00:00:00');
          amanha.setDate(amanha.getDate() + 1);
          data_consulta = amanha.toISOString().split('T')[0];
          console.log(`⚠️ Data no passado detectada E horário noturno (${horaAtual}h). Ajustando para AMANHÃ: ${data_consulta}`);
        } else {
          data_consulta = dataAtual;
          console.log(`⚠️ Data no passado detectada. Ajustando para HOJE: ${data_consulta} (${horaAtual}h)`);
        }
      }
    }
    
    console.log('✅ [SANITIZADO] Dados processados:', { 
      medico_nome, 
      medico_id, 
      data_consulta, 
      atendimento_nome, 
      dias_busca 
    });
    
    // 💬 LOGGING: Mensagem original do paciente (se fornecida)
    if (mensagem_original) {
      console.log('💬 Mensagem original do paciente:', mensagem_original);
    }
    
    // 🧠 ANÁLISE DE CONTEXTO: Usar mensagem original para inferir intenção
    if (mensagem_original && !data_consulta) {
      const mensagemLower = mensagem_original.toLowerCase();
      
      // Detectar se é pergunta aberta ("quando tem vaga?")
      const isPerguntaAberta = 
        mensagemLower.includes('quando') ||
        mensagemLower.includes('próxima') ||
        mensagemLower.includes('proxima') ||
        mensagemLower.includes('disponível') ||
        mensagemLower.includes('disponivel');
      
      if (isPerguntaAberta) {
        console.log('🔍 Pergunta aberta detectada. Buscando múltiplas datas disponíveis.');
      }
      
      // Detectar menção a dia da semana
      const diasSemanaMap: Record<string, number> = {
        'domingo': 0, 'segunda': 1, 'terça': 2, 'terca': 2,
        'quarta': 3, 'quinta': 4, 'sexta': 5, 'sábado': 6, 'sabado': 6
      };
      
      for (const [dia, num] of Object.entries(diasSemanaMap)) {
        if (mensagemLower.includes(dia)) {
          console.log(`📅 Dia da semana detectado na mensagem: ${dia} (${num})`);
          // Nota: Lógica de filtro por dia da semana pode ser implementada no futuro
          break;
        }
      }
    }

    // ✅ Validar campos obrigatórios
    if (!atendimento_nome || atendimento_nome.trim() === '') {
      return errorResponse('Campo obrigatório: atendimento_nome (ex: "Consulta Cardiológica", "Colonoscopia")');
    }
    
    if (!medico_nome && !medico_id) {
      return errorResponse('É necessário informar medico_nome OU medico_id');
    }
    
    // 🔍 Buscar médico COM busca inteligente (aceita nomes parciais)
    let medico;
    if (medico_id) {
      // Busca por ID (exata)
      const { data, error } = await supabase
        .from('medicos')
        .select('id, nome, ativo')
        .eq('id', medico_id)
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .single();
      
      medico = data;
      if (error || !medico) {
        console.error(`❌ Médico ID não encontrado: ${medico_id}`, error);
        return errorResponse(`Médico com ID "${medico_id}" não encontrado ou inativo`);
      }
      console.log(`✅ Médico encontrado por ID: ${medico.nome}`);
      
    } else {
      // 🔍 BUSCA SUPER INTELIGENTE POR NOME:
      // Remove TODA pontuação e espaços extras de ambos os lados para comparação
      // Exemplos: "Dra Adriana" → "Dra. Adriana Carla de Sena"
      //           "Marcelo" → "DR. MARCELO D'CARLI"
      
      console.log(`🔍 Buscando médico: "${medico_nome}"`);
      
      // Buscar TODOS os médicos ativos
      const { data: todosMedicos, error } = await supabase
        .from('medicos')
        .select('id, nome, ativo')
        .eq('cliente_id', clienteId)
        .eq('ativo', true);
      
      if (error) {
        console.error('❌ Erro ao buscar médicos:', error);
        return errorResponse(`Erro ao buscar médicos: ${error.message}`);
      }
      
      if (!todosMedicos || todosMedicos.length === 0) {
        return errorResponse('Nenhum médico ativo cadastrado no sistema');
      }
      
      // Função auxiliar: normalizar texto para comparação (sem pontuação, tudo minúsculo)
      const normalizar = (texto: string) => 
        texto.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
          .replace(/[.,\-']/g, '') // Remove pontuação
          .replace(/\s+/g, ' ') // Normaliza espaços
          .trim();
      
      const nomeNormalizado = normalizar(medico_nome);
      console.log(`🔍 Nome normalizado para busca: "${nomeNormalizado}"`);
      
      // Procurar médico que contenha o nome buscado
      const medicosEncontrados = todosMedicos.filter(m => {
        const nomeCompletoNormalizado = normalizar(m.nome);
        return nomeCompletoNormalizado.includes(nomeNormalizado);
      });
      
      if (medicosEncontrados.length === 0) {
        console.error(`❌ Nenhum médico encontrado para: "${medico_nome}"`);
        const sugestoes = todosMedicos.map(m => m.nome).slice(0, 10).join(', ');
        return errorResponse(
          `Médico "${medico_nome}" não encontrado. Médicos disponíveis: ${sugestoes}`
        );
      }
      
      if (medicosEncontrados.length > 1) {
        console.warn(`⚠️ Múltiplos médicos encontrados para "${medico_nome}":`, 
          medicosEncontrados.map(m => m.nome).join(', '));
      }
      
      medico = medicosEncontrados[0];
      console.log(`✅ Médico encontrado: "${medico_nome}" → "${medico.nome}"`);
    }

    // Buscar regras de negócio
    const regras = BUSINESS_RULES.medicos[medico.id];
    if (!regras) {
      return errorResponse(`Regras de atendimento não configuradas para ${medico.nome}`);
    }

    // Buscar serviço nas regras com matching inteligente MELHORADO
    const servicoKey = Object.keys(regras.servicos || {}).find(s => {
      const servicoLower = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove acentos
      const atendimentoLower = atendimento_nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      // Match exato (sem acentos)
      if (servicoLower === atendimentoLower) return true;
      
      // Match bidirecional (contém)
      if (servicoLower.includes(atendimentoLower) || atendimentoLower.includes(servicoLower)) {
        return true;
      }
      
      // 🆕 MELHORADO: Match por keywords com variações de grafia
      const keywords: Record<string, string[]> = {
        'endocrinologica': ['endocrino', 'endocrinologia', 'endocrinologista', 'consulta endocrino', 'consulta endocrinologista'],
        'cardiologica': ['cardio', 'cardiologia', 'cardiologista', 'consulta cardio', 'consulta cardiologista'],
        'ergometrico': ['ergo', 'ergometrico', 'teste ergo'],
        'ecocardiograma': ['eco', 'ecocardio'],
        'ultrassom': ['ultra', 'ultrassonografia']
      };
      
      for (const [base, aliases] of Object.entries(keywords)) {
        if (servicoLower.includes(base)) {
          return aliases.some(alias => atendimentoLower.includes(alias));
        }
      }
      
      return false;
    });
    
    // Logs de debug para matching
    if (servicoKey) {
      console.log(`✅ Match encontrado: "${atendimento_nome}" → "${servicoKey}"`);
    } else {
      console.warn(`⚠️ Serviço não encontrado: "${atendimento_nome}". Disponíveis: ${Object.keys(regras.servicos || {}).join(', ')}`);
      return errorResponse(
        `Serviço "${atendimento_nome}" não encontrado para ${medico.nome}. Serviços disponíveis: ${Object.keys(regras.servicos || {}).join(', ')}`
      );
    }

    const servico = regras.servicos[servicoKey];

    // Verificar se permite agendamento online
    if (!servico.permite_online) {
      console.log(`ℹ️ Serviço ${servicoKey} não permite agendamento online`);
      return successResponse({
        permite_online: false,
        medico: medico.nome,
        servico: servicoKey,
        message: servico.mensagem || 'Este serviço não pode ser agendado online.'
      });
    }

    // 🆕 SE NÃO FOI FORNECIDA DATA ESPECÍFICA, BUSCAR PRÓXIMAS DATAS DISPONÍVEIS
    if (!data_consulta) {
      const tipoAtendimento = servico.tipo || regras.tipo_agendamento || 'ordem_chegada';
      const proximasDatas = [];
      
      // Capturar datetime atual COMPLETO (com hora e minuto)
      const agora = new Date();
      const horaAtual = agora.getHours();
      const minutoAtual = agora.getMinutes();
      
      // Criar cópia apenas para comparação de datas
      const hoje = new Date(agora);
      hoje.setHours(0, 0, 0, 0);
      
      console.log(`🔍 Buscando próximas datas disponíveis a partir de ${agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (próximos ${dias_busca} dias)...`);
      
      let datasVerificadas = 0;
      let datasPuladasDiaSemana = 0;
      let datasPuladasBloqueio = 0;
      let datasSemVagas = 0;
      
      for (let i = 0; i < dias_busca; i++) {
        const dataAtual = new Date(hoje);
        dataAtual.setDate(dataAtual.getDate() + i);
        
        const dataFormatada = dataAtual.toISOString().split('T')[0];
        const diaSemana = dataAtual.getDay();
        datasVerificadas++;
        
        // Verificar se o médico atende neste dia
        if (servico.dias_semana && !servico.dias_semana.includes(diaSemana)) {
          datasPuladasDiaSemana++;
          continue;
        }

        // 🔒 Verificar se a data está bloqueada
        const { data: bloqueios, error: bloqueioError } = await supabase
          .from('bloqueios_agenda')
          .select('id, motivo')
          .eq('medico_id', medico.id)
          .lte('data_inicio', dataFormatada)
          .gte('data_fim', dataFormatada)
          .eq('status', 'ativo')
          .eq('cliente_id', CLIENTE_ID);

        if (!bloqueioError && bloqueios && bloqueios.length > 0) {
          console.log(`⛔ Data ${dataFormatada} bloqueada:`, bloqueios[0].motivo);
          datasPuladasBloqueio++;
          continue;
        }

        // Verificar disponibilidade para esta data
        const periodosDisponiveis = [];
        
        for (const [periodo, config] of Object.entries(servico.periodos)) {
          if ((config as any).dias_especificos && !(config as any).dias_especificos.includes(diaSemana)) {
            continue;
          }

          // 🆕 FILTRAR PERÍODOS QUE JÁ PASSARAM NO DIA ATUAL
          const ehHoje = (i === 0);
          
          if (ehHoje) {
            // Extrair horário de FIM do período
            const [horaFim, minFim] = (config as any).fim.split(':').map(Number);
            const horarioFimEmMinutos = horaFim * 60 + minFim;
            const horarioAtualEmMinutos = horaAtual * 60 + minutoAtual;
            
            // Se o período já acabou completamente, pular
            if (horarioFimEmMinutos <= horarioAtualEmMinutos) {
              console.log(`⏭️ Pulando período ${periodo} de hoje (fim ${(config as any).fim} ≤ ${horaAtual}:${minutoAtual.toString().padStart(2, '0')})`);
              continue;
            }
            
            console.log(`✅ Período ${periodo} ainda está válido hoje (fim ${(config as any).fim} > ${horaAtual}:${minutoAtual.toString().padStart(2, '0')})`);
          }

          const { count, error: countError } = await supabase
            .from('agendamentos')
            .select('*', { count: 'exact', head: true })
            .eq('medico_id', medico.id)
            .eq('data_agendamento', dataFormatada)
            .gte('hora_agendamento', (config as any).inicio)
            .lte('hora_agendamento', (config as any).fim)
            .in('status', ['agendado', 'confirmado']);

          if (countError) continue;

          const vagasOcupadas = count || 0;
          const vagasDisponiveis = (config as any).limite - vagasOcupadas;

          if (vagasDisponiveis > 0) {
            periodosDisponiveis.push({
              periodo: periodo === 'manha' ? 'Manhã' : 'Tarde',
              horario_distribuicao: (config as any).distribuicao_fichas || `${(config as any).inicio} às ${(config as any).fim}`,
              vagas_disponiveis: vagasDisponiveis,
              total_vagas: (config as any).limite
            });
          }
        }

        // Se encontrou períodos disponíveis nesta data, adicionar
        if (periodosDisponiveis.length > 0) {
          const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
          proximasDatas.push({
            data: dataFormatada,
            dia_semana: diasSemana[diaSemana],
            periodos: periodosDisponiveis
          });
          
          console.log(`✅ Data disponível encontrada: ${dataFormatada} (${diasSemana[diaSemana]})`);
          
          // Limitar a 5 datas
          if (proximasDatas.length >= 5) break;
        } else {
          datasSemVagas++;
        }
      }

      console.log(`📊 Estatísticas da busca:
        - Datas verificadas: ${datasVerificadas}
        - Puladas (dia da semana): ${datasPuladasDiaSemana}
        - Puladas (bloqueio): ${datasPuladasBloqueio}
        - Sem vagas: ${datasSemVagas}
        - Datas disponíveis encontradas: ${proximasDatas.length}`);

      if (proximasDatas.length === 0) {
        return errorResponse(`Não encontrei datas disponíveis para ${medico.nome} nos próximos ${dias_busca} dias. Por favor, entre em contato com a clínica.`);
      }

      const mensagem = `✅ ${medico.nome} - ${servicoKey}\n\n📅 ${proximasDatas.length} datas disponíveis:\n\n` +
        proximasDatas.map((d: any) => {
          const periodos = d.periodos.map((p: any) => 
            `  • ${p.periodo}: ${p.vagas_disponiveis} vaga(s) disponível(is) de ${p.total_vagas}`
          ).join('\n');
          return `${d.dia_semana}, ${d.data}\n${periodos}`;
        }).join('\n\n') +
        (tipoAtendimento === 'ordem_chegada' 
          ? '\n\n⚠️ ORDEM DE CHEGADA: Não há horário marcado. Paciente deve chegar no período para pegar ficha.'
          : '');

      return successResponse({
        disponivel: true,
        tipo_agendamento: tipoAtendimento,
        medico: medico.nome,
        servico: servicoKey,
        horario_busca: agora.toISOString(),
        proximas_datas: proximasDatas,
        mensagem_whatsapp: mensagem,
        message: mensagem
      });
    }

    // 🎯 COMPORTAMENTO ORIGINAL: VERIFICAR DATA ESPECÍFICA
    // Verificar dia da semana permitido
    const diaSemana = getDiaSemana(data_consulta);
    const diasNomes = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    
    if (servico.dias_semana && !servico.dias_semana.includes(diaSemana)) {
      const diasPermitidos = servico.dias_semana.map((d: number) => diasNomes[d]).join(', ');
      return errorResponse(
        `${medico.nome} não atende ${servicoKey} neste dia. Dias disponíveis: ${diasPermitidos}`
      );
    }

    // 🔒 VERIFICAR SE A DATA ESTÁ BLOQUEADA
    const { data: bloqueios, error: bloqueioError } = await supabase
      .from('bloqueios_agenda')
      .select('id, motivo')
      .eq('medico_id', medico.id)
      .lte('data_inicio', data_consulta)
      .gte('data_fim', data_consulta)
      .eq('status', 'ativo')
      .eq('cliente_id', clienteId);

    if (!bloqueioError && bloqueios && bloqueios.length > 0) {
      console.log(`⛔ Data ${data_consulta} bloqueada:`, bloqueios[0].motivo);
      return successResponse({
        disponivel: false,
        bloqueada: true,
        medico: medico.nome,
        servico: servicoKey,
        data: data_consulta,
        motivo_bloqueio: bloqueios[0].motivo,
        message: `A agenda do(a) ${medico.nome} está bloqueada em ${data_consulta}. Motivo: ${bloqueios[0].motivo}. Por favor, escolha outra data.`
      });
    }

    // 🎯 DETECTAR TIPO DE ATENDIMENTO
    const tipoAtendimento = servico.tipo || regras.tipo_agendamento || 'ordem_chegada';
    console.log(`📋 Tipo de atendimento detectado: ${tipoAtendimento}`);

    // Contar agendamentos existentes para cada período
    const periodosDisponiveis = [];
    
    for (const [periodo, config] of Object.entries(servico.periodos)) {
      // Verificar se o período é válido para este dia da semana
      if ((config as any).dias_especificos && !(config as any).dias_especificos.includes(diaSemana)) {
        continue;
      }

      // 🆕 SE A DATA FOR HOJE, VERIFICAR SE O PERÍODO JÁ PASSOU
      const ehHoje = (data_consulta === dataAtual);
      
      if (ehHoje) {
        const [horaFim, minFim] = (config as any).fim.split(':').map(Number);
        const horarioFimEmMinutos = horaFim * 60 + minFim;
        
        // Se o período já acabou, pular
        if (horarioFimEmMinutos <= horarioAtualEmMinutos) {
          console.log(`⏭️ Pulando período ${periodo} (fim ${(config as any).fim} já passou às ${horaAtual}:${getDataHoraAtualBrasil().minuto})`);
          continue;
        }
      }

      // Contar quantos agendamentos já existem neste período
      const { count, error: countError } = await supabase
        .from('agendamentos')
        .select('*', { count: 'exact', head: true })
        .eq('medico_id', medico.id)
        .eq('data_agendamento', data_consulta)
        .gte('hora_agendamento', (config as any).inicio)
        .lte('hora_agendamento', (config as any).fim)
        .in('status', ['agendado', 'confirmado']);

      if (countError) {
        console.error('❌ Erro ao contar agendamentos:', countError);
        continue;
      }

      const vagasOcupadas = count || 0;
      const vagasDisponiveis = (config as any).limite - vagasOcupadas;

      periodosDisponiveis.push({
        periodo: periodo === 'manha' ? 'Manhã' : 'Tarde',
        horario_distribuicao: (config as any).distribuicao_fichas || `${(config as any).inicio} às ${(config as any).fim}`,
        vagas_ocupadas: vagasOcupadas,
        vagas_disponiveis: vagasDisponiveis,
        total_vagas: (config as any).limite,
        disponivel: vagasDisponiveis > 0,
        hora_inicio: (config as any).inicio,
        hora_fim: (config as any).fim,
        intervalo_minutos: (config as any).intervalo_minutos
      });
    }

    if (periodosDisponiveis.length === 0) {
      return errorResponse(`${medico.nome} não atende ${servicoKey} na data ${data_consulta}`);
    }

    // 🎯 RESPOSTA DIFERENCIADA POR TIPO DE ATENDIMENTO

    if (tipoAtendimento === 'ordem_chegada') {
      // ✅ ORDEM DE CHEGADA - NÃO retorna horários específicos
      console.log('✅ Retornando disponibilidade por ORDEM DE CHEGADA');
      
      const temVagas = periodosDisponiveis.some(p => p.disponivel);
      const mensagem = temVagas
        ? `✅ ${medico.nome} - ${servicoKey}\n📅 ${data_consulta}\n\n` +
          periodosDisponiveis.filter(p => p.disponivel).map(p => 
            `${p.periodo}: ${p.vagas_disponiveis} vaga(s) disponível(is) de ${p.total_vagas}\n` +
            `Distribuição: ${p.horario_distribuicao}`
          ).join('\n\n') +
          '\n\n⚠️ ORDEM DE CHEGADA: Não há horário marcado. Paciente deve chegar no período para pegar ficha.'
        : `❌ Sem vagas disponíveis para ${medico.nome} em ${data_consulta}`;
      
      return successResponse({
        disponivel: temVagas,
        tipo_agendamento: 'ordem_chegada',
        medico: medico.nome,
        servico: servicoKey,
        data: data_consulta,
        periodos: periodosDisponiveis,
        mensagem_whatsapp: mensagem,
        message: mensagem
      });
    } else {
      // ✅ HORA MARCADA - retorna slots específicos
      console.log('✅ Retornando disponibilidade por HORA MARCADA');
      const horariosDisponiveis = [];
      
      for (const periodo of periodosDisponiveis) {
        if (!periodo.disponivel) continue;

        const intervaloMinutos = periodo.intervalo_minutos || 30;
        
        // Gerar slots de tempo
        const [horaInicio, minInicio] = periodo.hora_inicio.split(':').map(Number);
        const [horaFim, minFim] = periodo.hora_fim.split(':').map(Number);
        
        let horaAtual = horaInicio * 60 + minInicio;
        const horaLimite = horaFim * 60 + minFim;
        
        while (horaAtual < horaLimite) {
          const h = Math.floor(horaAtual / 60);
          const m = horaAtual % 60;
          const horarioFormatado = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
          
          // Verificar se este horário específico está ocupado
          const { count } = await supabase
            .from('agendamentos')
            .select('*', { count: 'exact', head: true })
            .eq('medico_id', medico.id)
            .eq('data_agendamento', data_consulta)
            .eq('hora_agendamento', horarioFormatado)
            .in('status', ['agendado', 'confirmado']);
          
          if (count === 0) {
            horariosDisponiveis.push({
              hora: horarioFormatado,
              disponivel: true,
              periodo: periodo.periodo.toLowerCase()
            });
          }
          
          horaAtual += intervaloMinutos;
        }
      }

      const mensagem = horariosDisponiveis.length > 0
        ? `✅ ${medico.nome} - ${servicoKey}\n📅 ${data_consulta}\n\n` +
          `${horariosDisponiveis.length} horários disponíveis:\n` +
          horariosDisponiveis.map(h => `• ${h.hora}`).join('\n')
        : `❌ Sem horários disponíveis para ${medico.nome} em ${data_consulta}`;
      
      return successResponse({
        disponivel: horariosDisponiveis.length > 0,
        tipo_agendamento: 'hora_marcada',
        medico: medico.nome,
        servico: servicoKey,
        data: data_consulta,
        horarios_disponiveis: horariosDisponiveis,
        total: horariosDisponiveis.length,
        mensagem_whatsapp: mensagem,
        message: mensagem
      });
    }

  } catch (error: any) {
    console.error('❌ [ERRO CRÍTICO] Falha ao verificar disponibilidade:', {
      error_message: error?.message,
      error_stack: error?.stack,
      error_code: error?.code,
      parametros_recebidos: body
    });
    
    return errorResponse(
      `Erro ao verificar disponibilidade: ${error?.message || 'Erro desconhecido'}. ` +
      `Verifique os logs para mais detalhes.`
    );
  }
}

// Buscar pacientes
async function handlePatientSearch(supabase: any, body: any, clienteId: string) {
  try {
    const { busca, tipo } = body;

    if (!busca) {
      return errorResponse('Campo obrigatório: busca (nome, telefone ou data de nascimento)');
    }

    let query = supabase
      .from('pacientes')
      .select('id, nome_completo, data_nascimento, celular, telefone, convenio')
      .eq('cliente_id', clienteId)
      .limit(10);

    switch (tipo) {
      case 'nome':
        query = query.ilike('nome_completo', `%${busca}%`);
        break;
      case 'telefone':
        const telefone = busca.replace(/\D/g, '');
        query = query.or(`celular.ilike.%${telefone}%,telefone.ilike.%${telefone}%`);
        break;
      case 'nascimento':
        query = query.eq('data_nascimento', busca);
        break;
      default:
        // Busca geral
        const telefoneGeral = busca.replace(/\D/g, '');
        query = query.or(`nome_completo.ilike.%${busca}%,celular.ilike.%${telefoneGeral}%,telefone.ilike.%${telefoneGeral}%,data_nascimento.eq.${busca}`);
    }

    const { data: pacientes, error } = await query;

    if (error) {
      return errorResponse(`Erro ao buscar pacientes: ${error.message}`);
    }

    return successResponse({
      message: `${pacientes?.length || 0} paciente(s) encontrado(s)`,
      pacientes: pacientes || [],
      total: pacientes?.length || 0
    });

  } catch (error: any) {
    return errorResponse(`Erro ao buscar pacientes: ${error?.message || 'Erro desconhecido'}`);
  }
}

// Funções auxiliares
function successResponse(data: any) {
  return new Response(JSON.stringify({
    success: true,
    timestamp: new Date().toISOString(),
    ...data
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
