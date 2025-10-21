import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Regras de negócio para agendamento via LLM Agent (N8N/WhatsApp)
// Sistema web NÃO usa essas regras - funciona sem restrições
const BUSINESS_RULES = {
  medicos: {
    // Dr. Marcelo D'Carli - Cardiologista
    '1e110923-50df-46ff-a57a-29d88e372900': {
      nome: 'DR. MARCELO D\'CARLI',
      servicos: {
        'Consulta Cardiológica': {
          permite_online: true,
          dias_semana: [1, 2, 3, 4, 5], // seg-sex
          periodos: {
            manha: { inicio: '07:30', fim: '10:00', limite: 9 },
            tarde: { inicio: '13:30', fim: '15:00', limite: 9, dias_especificos: [1, 3] } // seg e qua
          }
        },
        'Teste Ergométrico': {
          permite_online: true,
          dias_semana: [2, 3, 4], // ter, qua, qui
          periodos: {
            manha: { inicio: '07:30', fim: '10:00', limite: 8, dias_especificos: [3] }, // qua
            tarde: { inicio: '13:30', fim: '15:00', limite: 8, dias_especificos: [2, 4] } // ter e qui
          }
        },
        'ECG': {
          permite_online: false,
          mensagem: 'O ECG de rotina não precisa de agendamento. Compareça à clínica de segunda a sexta (8h-10h) ou quarta à tarde (14h-15h), por ordem de chegada.'
        }
      }
    },
    
    // Dra. Adriana Carla de Sena - Endocrinologista
    '32d30887-b876-4502-bf04-e55d7fb55b50': {
      nome: 'DRA. ADRIANA CARLA DE SENA',
      idade_minima: 18,
      servicos: {
        'Consulta Endocrinológica': {
          permite_online: true,
          dias_semana: [1, 2, 3, 4, 5],
          periodos: {
            manha: { inicio: '08:00', fim: '10:00', limite: 9, atendimento_inicio: '08:45' },
            tarde: { inicio: '13:00', fim: '15:00', limite: 9, dias_especificos: [2, 3], atendimento_inicio: '14:45' }
          }
        }
      }
    },
    
    // Dr. Pedro Francisco - Ultrassonografista
    '66e9310d-34cd-4005-8937-74e87125dc03': {
      nome: 'DR. PEDRO FRANCISCO',
      servicos: {
        'Consulta': {
          permite_online: true,
          dias_semana: [2, 4], // ter e qui apenas
          periodos: {
            manha: { inicio: '09:30', fim: '10:00', limite: 4, atendimento_inicio: '10:00' }
          },
          mensagem_extra: 'Chegue entre 9h30 e 10h. O atendimento é após os exames, por ordem de chegada.'
        }
      }
    },
    
    // Dr. Alessandro Dias - Cardiologista (Ecocardiograma)
    'c192e08e-e216-4c22-99bf-b5992ce05e17': {
      nome: 'DR. ALESSANDRO DIAS',
      servicos: {
        'Ecocardiograma': {
          permite_online: true,
          dias_semana: [1], // apenas segunda
          periodos: {
            manha: { inicio: '08:00', fim: '09:00', limite: 9 }
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
    
    // Mapear dados flexivelmente (aceitar diferentes formatos)
    const mappedData = mapSchedulingData(body);
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
    const { medico_nome, medico_id, data_consulta, periodo, atendimento_nome } = body;

    if ((!medico_nome && !medico_id) || !data_consulta) {
      return errorResponse('Campos obrigatórios: (medico_nome ou medico_id) e data_consulta');
    }

    // Buscar médico COM filtro de cliente
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

    // Verificar se tem regras de negócio com sistema de ordem de chegada
    const regras = BUSINESS_RULES.medicos[medico.id];
    
    if (regras && atendimento_nome) {
      // Buscar serviço nas regras com matching inteligente
      const servicoKey = Object.keys(regras.servicos || {}).find(s => {
        const servicoLower = s.toLowerCase();
        const atendimentoLower = atendimento_nome.toLowerCase();
        
        // Match exato
        if (servicoLower === atendimentoLower) return true;
        
        // Match bidirecional (contém)
        if (servicoLower.includes(atendimentoLower) || atendimentoLower.includes(servicoLower)) {
          return true;
        }
        
        // Match por keywords específicas
        const keywords: Record<string, string[]> = {
          'endocrinológica': ['endocrino', 'endocrinologia', 'consulta endocrino', 'consulta'],
          'cardiológica': ['cardio', 'cardiologia', 'consulta cardio', 'consulta'],
          'ergométrico': ['ergo', 'ergometrico', 'teste ergo'],
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
      }
      
      if (servicoKey) {
        const servico = regras.servicos[servicoKey];
        
        // Se não permite online, retornar mensagem
        if (!servico.permite_online) {
          console.log(`ℹ️ Serviço ${servicoKey} não permite agendamento online`);
          return successResponse({
            medico: medico.nome,
            servico: servicoKey,
            permite_agendamento_online: false,
            mensagem: servico.mensagem
          });
        }
        
        // Verificar dia da semana
        const diaSemana = getDiaSemana(data_consulta);
        const diasNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        
        // Retornar disponibilidade por ordem de chegada
        if (servico.periodos) {
          const periodos = [];
          
          for (const [periodoNome, config] of Object.entries(servico.periodos)) {
            // Verificar se atende neste dia da semana
            if (servico.dias_semana && !servico.dias_semana.includes(diaSemana)) {
              continue;
            }
            
            // Verificar dias específicos do período
            if ((config as any).dias_especificos && !(config as any).dias_especificos.includes(diaSemana)) {
              console.log(`ℹ️ ${regras.nome} não atende à ${periodoNome === 'manha' ? 'manhã' : 'tarde'} às ${diasNomes[diaSemana]}`);
              continue;
            }
            
            // Contar vagas ocupadas no período
            const horaInicio = periodoNome === 'manha' ? '00:00:00' : '12:00:00';
            const horaFim = periodoNome === 'manha' ? '12:00:00' : '23:59:59';
            
            const { data: agendamentos } = await supabase
              .from('agendamentos')
              .select('id')
              .eq('medico_id', medico.id)
              .eq('data_agendamento', data_consulta)
              .eq('cliente_id', clienteId)
              .gte('hora_agendamento', horaInicio)
              .lt('hora_agendamento', horaFim)
              .in('status', ['agendado', 'confirmado']);
            
            const vagasOcupadas = agendamentos?.length || 0;
            const vagasDisponiveis = (config as any).limite - vagasOcupadas;
            
            periodos.push({
              periodo: periodoNome === 'manha' ? 'Manhã' : 'Tarde',
              horario_distribuicao: `${(config as any).inicio} às ${(config as any).fim}`,
              horario_atendimento_inicio: (config as any).atendimento_inicio || (config as any).inicio,
              vagas_ocupadas: vagasOcupadas,
              vagas_disponiveis: vagasDisponiveis,
              total_vagas: (config as any).limite,
              disponivel: vagasDisponiveis > 0,
              mensagem_extra: servico.mensagem_extra
            });
          }
          
          if (periodos.length === 0) {
            return errorResponse(`${regras.nome} não atende ${servicoKey} no dia ${diasNomes[diaSemana]}`);
          }
          
          console.log(`✅ Retornando disponibilidade por ordem de chegada para ${servicoKey}`);
          return successResponse({
            medico: medico.nome,
            servico: servicoKey,
            data: data_consulta,
            dia_semana: diasNomes[diaSemana],
            tipo_agendamento: 'ordem_chegada',
            periodos,
            instrucao: 'Este médico atende por ORDEM DE CHEGADA. Chegue no horário indicado para distribuição de fichas. Quanto mais cedo chegar, mais cedo será atendido.'
          });
        }
      }
    }

    // ===== FALLBACK: Retornar horários genéricos (comportamento original) =====
    console.log(`ℹ️ Usando método padrão de disponibilidade (slots de 30 min)`);
    
    // Buscar agendamentos ocupados COM filtro de cliente
    const { data: agendamentos } = await supabase
      .from('agendamentos')
      .select('hora_agendamento')
      .eq('medico_id', medico.id)
      .eq('data_agendamento', data_consulta)
      .eq('cliente_id', clienteId)
      .in('status', ['agendado', 'confirmado']);

    const horariosOcupados = agendamentos?.map((a: any) => a.hora_agendamento) || [];

    // Gerar horários disponíveis (08:00 às 18:00, intervalos de 30min)
    const horarios = [];
    const inicio = periodo === 'tarde' ? 13 : 8;
    const fim = periodo === 'manha' ? 12 : 18;

    for (let hora = inicio; hora <= fim; hora++) {
      for (let minuto = 0; minuto < 60; minuto += 30) {
        if (hora === fim && minuto > 0) break;
        
        const horarioStr = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00`;
        
        if (!horariosOcupados.includes(horarioStr)) {
          horarios.push({
            hora: horarioStr,
            disponivel: true,
            periodo: hora < 12 ? 'manhã' : 'tarde'
          });
        }
      }
    }

    return successResponse({
      message: `${horarios.length} horários disponíveis encontrados`,
      medico: medico.nome,
      data: data_consulta,
      horarios_disponiveis: horarios,
      total: horarios.length
    });

  } catch (error: any) {
    return errorResponse(`Erro ao verificar disponibilidade: ${error?.message || 'Erro desconhecido'}`);
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
