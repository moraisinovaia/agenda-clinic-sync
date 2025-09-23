import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const url = new URL(req.url);
    const method = req.method;
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    console.log(`🤖 LLM Agent API Call: ${method} ${url.pathname}`);

    if (method === 'POST') {
      const body = await req.json();
      const action = pathParts[1]; // /llm-agent-api/{action}

      switch (action) {
        case 'schedule':
          return await handleSchedule(supabase, body);
        case 'check-patient':
          return await handleCheckPatient(supabase, body);
        case 'reschedule':
          return await handleReschedule(supabase, body);
        case 'cancel':
          return await handleCancel(supabase, body);
        case 'availability':
          return await handleAvailability(supabase, body);
        case 'patient-search':
          return await handlePatientSearch(supabase, body);
        default:
          return errorResponse('Ação não reconhecida. Ações disponíveis: schedule, check-patient, reschedule, cancel, availability, patient-search');
      }
    }

    return errorResponse('Método não permitido. Use POST.');

  } catch (error) {
    console.error('❌ Erro na LLM Agent API:', error);
    return errorResponse(`Erro interno: ${error.message}`);
  }
})

// Agendar consulta
async function handleSchedule(supabase: any, body: any) {
  try {
    const { 
      paciente_nome, 
      data_nascimento, 
      convenio, 
      telefone, 
      celular, 
      medico_nome, 
      atendimento_nome, 
      data_consulta, 
      hora_consulta, 
      observacoes 
    } = body;

    // Validar campos obrigatórios
    if (!paciente_nome || !data_nascimento || !convenio || !celular || !medico_nome || !data_consulta || !hora_consulta) {
      return errorResponse('Campos obrigatórios: paciente_nome, data_nascimento, convenio, celular, medico_nome, data_consulta, hora_consulta');
    }

    // Buscar médico por nome
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id, nome, ativo')
      .ilike('nome', `%${medico_nome}%`)
      .eq('ativo', true)
      .single();

    if (medicoError || !medico) {
      return errorResponse(`Médico "${medico_nome}" não encontrado ou inativo`);
    }

    // Buscar atendimento por nome (se especificado)
    let atendimento_id = null;
    if (atendimento_nome) {
      const { data: atendimento, error: atendimentoError } = await supabase
        .from('atendimentos')
        .select('id, nome')
        .ilike('nome', `%${atendimento_nome}%`)
        .eq('medico_id', medico.id)
        .eq('ativo', true)
        .single();

      if (atendimentoError || !atendimento) {
        return errorResponse(`Atendimento "${atendimento_nome}" não encontrado para o médico ${medico.nome}`);
      }
      atendimento_id = atendimento.id;
    } else {
      // Buscar primeiro atendimento disponível do médico
      const { data: atendimentos } = await supabase
        .from('atendimentos')
        .select('id')
        .eq('medico_id', medico.id)
        .eq('ativo', true)
        .limit(1);

      if (!atendimentos || atendimentos.length === 0) {
        return errorResponse(`Nenhum atendimento disponível para o médico ${medico.nome}`);
      }
      atendimento_id = atendimentos[0].id;
    }

    // Criar agendamento usando a função atômica
    const { data: result, error: agendamentoError } = await supabase
      .rpc('criar_agendamento_atomico', {
        p_nome_completo: paciente_nome,
        p_data_nascimento: data_nascimento,
        p_convenio: convenio,
        p_telefone: telefone || null,
        p_celular: celular,
        p_medico_id: medico.id,
        p_atendimento_id: atendimento_id,
        p_data_agendamento: data_consulta,
        p_hora_agendamento: hora_consulta,
        p_observacoes: observacoes || null,
        p_criado_por: 'llm-agent',
        p_criado_por_user_id: null
      });

    if (agendamentoError) {
      return errorResponse(`Erro ao agendar: ${agendamentoError.message}`);
    }

    if (!result?.success) {
      return errorResponse(`Erro ao agendar: ${result?.error || 'Erro desconhecido'}`);
    }

    return successResponse({
      message: `Consulta agendada com sucesso para ${paciente_nome}`,
      agendamento_id: result.agendamento_id,
      paciente_id: result.paciente_id,
      medico: medico.nome,
      data: data_consulta,
      hora: hora_consulta
    });

  } catch (error) {
    return errorResponse(`Erro ao processar agendamento: ${error.message}`);
  }
}

// Verificar se paciente tem consultas agendadas
async function handleCheckPatient(supabase: any, body: any) {
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
      .in('status', ['agendado', 'confirmado'])
      .gte('data_agendamento', new Date().toISOString().split('T')[0])
      .order('data_agendamento', { ascending: true });

    // Buscar por nome do paciente
    if (paciente_nome) {
      const { data: pacientes } = await supabase
        .from('pacientes')
        .select('id')
        .ilike('nome_completo', `%${paciente_nome}%`);

      if (pacientes && pacientes.length > 0) {
        const paciente_ids = pacientes.map(p => p.id);
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
      filteredAgendamentos = filteredAgendamentos.filter(a => 
        a.pacientes?.data_nascimento === data_nascimento
      );
    }

    if (celular) {
      filteredAgendamentos = filteredAgendamentos.filter(a => 
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

    const consultas = filteredAgendamentos.map(a => ({
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

  } catch (error) {
    return errorResponse(`Erro ao verificar paciente: ${error.message}`);
  }
}

// Remarcar consulta
async function handleReschedule(supabase: any, body: any) {
  try {
    const { agendamento_id, nova_data, nova_hora, observacoes } = body;

    if (!agendamento_id || !nova_data || !nova_hora) {
      return errorResponse('Campos obrigatórios: agendamento_id, nova_data, nova_hora');
    }

    // Verificar se agendamento existe
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
      .single();

    if (checkError || !agendamento) {
      return errorResponse('Agendamento não encontrado');
    }

    if (agendamento.status === 'cancelado') {
      return errorResponse('Não é possível remarcar consulta cancelada');
    }

    // Verificar disponibilidade do novo horário
    const { data: conflitos } = await supabase
      .from('agendamentos')
      .select('id')
      .eq('medico_id', agendamento.medico_id)
      .eq('data_agendamento', nova_data)
      .eq('hora_agendamento', nova_hora)
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

  } catch (error) {
    return errorResponse(`Erro ao remarcar consulta: ${error.message}`);
  }
}

// Cancelar consulta
async function handleCancel(supabase: any, body: any) {
  try {
    const { agendamento_id, motivo } = body;

    if (!agendamento_id) {
      return errorResponse('Campo obrigatório: agendamento_id');
    }

    // Verificar se agendamento existe
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

  } catch (error) {
    return errorResponse(`Erro ao cancelar consulta: ${error.message}`);
  }
}

// Verificar disponibilidade de horários
async function handleAvailability(supabase: any, body: any) {
  try {
    const { medico_nome, data_consulta, periodo } = body;

    if (!medico_nome || !data_consulta) {
      return errorResponse('Campos obrigatórios: medico_nome, data_consulta');
    }

    // Buscar médico
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id, nome, ativo')
      .ilike('nome', `%${medico_nome}%`)
      .eq('ativo', true)
      .single();

    if (medicoError || !medico) {
      return errorResponse(`Médico "${medico_nome}" não encontrado ou inativo`);
    }

    // Buscar agendamentos ocupados
    const { data: agendamentos } = await supabase
      .from('agendamentos')
      .select('hora_agendamento')
      .eq('medico_id', medico.id)
      .eq('data_agendamento', data_consulta)
      .in('status', ['agendado', 'confirmado']);

    const horariosOcupados = agendamentos?.map(a => a.hora_agendamento) || [];

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

  } catch (error) {
    return errorResponse(`Erro ao verificar disponibilidade: ${error.message}`);
  }
}

// Buscar pacientes
async function handlePatientSearch(supabase: any, body: any) {
  try {
    const { busca, tipo } = body;

    if (!busca) {
      return errorResponse('Campo obrigatório: busca (nome, telefone ou data de nascimento)');
    }

    let query = supabase
      .from('pacientes')
      .select('id, nome_completo, data_nascimento, celular, telefone, convenio')
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

  } catch (error) {
    return errorResponse(`Erro ao buscar pacientes: ${error.message}`);
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