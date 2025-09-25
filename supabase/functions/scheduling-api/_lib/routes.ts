import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { enviarPreparosAutomaticos } from './preparos.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// GET /scheduling-api - Listar agendamentos
export async function handleGetAppointments(supabase: any) {
  const { data: appointments, error } = await supabase
    .from('agendamentos')
    .select(`
      *,
      pacientes:paciente_id(*),
      medicos:medico_id(*),
      atendimentos:atendimento_id(*)
    `)
    .order('data_agendamento', { ascending: true })
    .order('hora_agendamento', { ascending: true });

  if (error) throw error;

  return new Response(
    JSON.stringify({ success: true, data: appointments }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// POST /scheduling-api - Criar agendamento usando função atômica
export async function handleCreateAppointment(supabase: any, body: any) {
  console.log('📝 Dados recebidos do n8n:', body);

  const { 
    nomeCompleto, 
    dataNascimento, 
    convenio, 
    telefone, 
    celular,
    medicoId, 
    atendimentoId,
    dataAgendamento, 
    horaAgendamento, 
    observacoes,
    criadoPor = 'Assistente Noah (WhatsApp)',
    usuarioResponsavel = null
  } = body;

  // Validações básicas
  if (!nomeCompleto || !dataNascimento || !convenio || !celular || !medicoId || !dataAgendamento || !horaAgendamento) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Campos obrigatórios: nomeCompleto, dataNascimento, convenio, celular, medicoId, dataAgendamento, horaAgendamento' 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validar atendimento
  if (!atendimentoId) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'É necessário especificar atendimentoId' 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validação de formato de celular brasileiro
  const celularRegex = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;
  if (!celularRegex.test(celular)) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Formato de celular inválido. Use o formato (XX) XXXXX-XXXX' 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validar nome completo
  if (nomeCompleto.trim().length < 3) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Nome completo deve ter pelo menos 3 caracteres' 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validar data/hora não é no passado
  const appointmentDateTime = new Date(`${dataAgendamento}T${horaAgendamento}`);
  const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
  
  if (appointmentDateTime <= oneHourFromNow) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Agendamento deve ser feito com pelo menos 1 hora de antecedência' 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verificar se já existe agendamento no mesmo horário para o médico
  const { data: existingAppointment } = await supabase
    .from('agendamentos')
    .select('id')
    .eq('medico_id', medicoId)
    .eq('data_agendamento', dataAgendamento)
    .eq('hora_agendamento', horaAgendamento)
    .in('status', ['agendado', 'confirmado'])
    .maybeSingle();

  if (existingAppointment) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Este horário já está ocupado para o médico selecionado' 
      }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verificar se o paciente já tem agendamento no mesmo dia e horário
  const { data: patientConflict } = await supabase
    .from('agendamentos')
    .select('id, medicos!inner(nome)')
    .eq('data_agendamento', dataAgendamento)
    .eq('hora_agendamento', horaAgendamento)
    .in('status', ['agendado', 'confirmado'])
    .or(`pacientes.nome_completo.ilike.%${nomeCompleto}%,pacientes.celular.eq.${celular}`)
    .maybeSingle();

  if (patientConflict) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Paciente já possui agendamento neste horário' 
      }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Usar sempre função atômica para agendamento simples
    const { data: result, error } = await supabase.rpc('criar_agendamento_atomico', {
      p_nome_completo: nomeCompleto,
      p_data_nascimento: dataNascimento,
      p_convenio: convenio,
      p_telefone: telefone || null,
      p_celular: celular,
      p_medico_id: medicoId,
      p_atendimento_id: atendimentoId,
      p_data_agendamento: dataAgendamento,
      p_hora_agendamento: horaAgendamento,
      p_observacoes: observacoes || null,
      p_criado_por: criadoPor,
      p_criado_por_user_id: usuarioResponsavel,
    });

    if (error) {
      console.error('❌ Erro na função atômica:', error);
      throw error;
    }

    console.log('✅ Resultado da função atômica:', result);

    // Verificar se a função retornou sucesso
    if (!result?.success) {
      const errorMessage = result?.error || result?.message || 'Erro desconhecido na criação do agendamento';
      console.error('❌ Função retornou erro:', errorMessage);
      
      // Determinar status code baseado no tipo de erro
      let statusCode = 500;
      if (errorMessage.includes('já está ocupado')) {
        statusCode = 409;
      } else if (errorMessage.includes('obrigatório') || errorMessage.includes('inválido')) {
        statusCode = 400;
      } else if (errorMessage.includes('não encontrado')) {
        statusCode = 404;
      } else if (errorMessage.includes('não está ativo') || errorMessage.includes('bloqueada') || 
                 errorMessage.includes('idade') || errorMessage.includes('convênio')) {
        statusCode = 422;
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage 
        }),
        { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar dados completos do agendamento criado para envio de preparos
    const { data: appointment, error: fetchError } = await supabase
      .from('agendamentos')
      .select(`
        *,
        pacientes:paciente_id(*),
        medicos:medico_id(*),
        atendimentos:atendimento_id(*)
      `)
      .eq('id', result.agendamento_id)
      .single();

    if (fetchError) {
      console.error('❌ Erro ao buscar dados do agendamento:', fetchError);
      // Não falhar por causa disso, apenas logar
    } else {
      // Enviar preparos automáticos se necessário
      try {
        await enviarPreparosAutomaticos(appointment);
      } catch (preparosError) {
        console.error('❌ Erro ao enviar preparos automáticos:', preparosError);
        // Não falhar por causa disso, apenas logar
      }
    }

    console.log(`✅ Agendamento N8N criado com sucesso: ${result.agendamento_id}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          id: result.agendamento_id,
          paciente_id: result.paciente_id,
          message: result.message
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro crítico na criação do agendamento N8N:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor'
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// PUT /scheduling-api/:id - Remarcar agendamento
export async function handleUpdateAppointment(supabase: any, appointmentId: string, body: any) {
  const { dataAgendamento, horaAgendamento, observacoes } = body;

  console.log(`🔄 Remarcando agendamento ${appointmentId}`);

  if (!dataAgendamento || !horaAgendamento) {
    return new Response(
      JSON.stringify({ success: false, error: 'dataAgendamento e horaAgendamento são obrigatórios' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Buscar agendamento atual
  const { data: currentAppointment } = await supabase
    .from('agendamentos')
    .select('medico_id')
    .eq('id', appointmentId)
    .single();

  if (!currentAppointment) {
    return new Response(
      JSON.stringify({ success: false, error: 'Agendamento não encontrado' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verificar conflito no novo horário
  const { data: conflictCheck } = await supabase
    .from('agendamentos')
    .select('id')
    .eq('medico_id', currentAppointment.medico_id)
    .eq('data_agendamento', dataAgendamento)
    .eq('hora_agendamento', horaAgendamento)
    .eq('status', 'agendado')
    .neq('id', appointmentId)
    .maybeSingle();

  if (conflictCheck) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'O novo horário já está ocupado para este médico' 
      }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Atualizar agendamento
  const { data: updatedAppointment, error } = await supabase
    .from('agendamentos')
    .update({
      data_agendamento: dataAgendamento,
      hora_agendamento: horaAgendamento,
      observacoes: observacoes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .select(`
      *,
      pacientes:paciente_id(*),
      medicos:medico_id(*),
      atendimentos:atendimento_id(*)
    `)
    .single();

  if (error) throw error;

  console.log('✅ Agendamento remarcado:', appointmentId);
  return new Response(
    JSON.stringify({ success: true, data: updatedAppointment }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// PATCH /scheduling-api/:id/status - Alterar status (cancelar/confirmar)
export async function handleUpdateAppointmentStatus(supabase: any, appointmentId: string, body: any) {
  const { status } = body;

  console.log(`📋 Alterando status do agendamento ${appointmentId} para ${status}`);

  if (!['agendado', 'confirmado', 'cancelado', 'realizado'].includes(status)) {
    return new Response(
      JSON.stringify({ success: false, error: 'Status inválido. Use: agendado, confirmado, cancelado, realizado' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: updatedAppointment, error } = await supabase
    .from('agendamentos')
    .update({ 
      status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .select(`
      *,
      pacientes:paciente_id(*),
      medicos:medico_id(*),
      atendimentos:atendimento_id(*)
    `)
    .single();

  if (error) throw error;

  console.log(`✅ Status alterado para ${status}:`, appointmentId);
  return new Response(
    JSON.stringify({ success: true, data: updatedAppointment }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// GET /scheduling-api/availability - Consultar horários vagos
export async function handleCheckAvailability(supabase: any, params: URLSearchParams) {
  const medicoId = params.get('medicoId');
  const medicoNome = params.get('medicoNome');
  const dataInicio = params.get('dataInicio') || new Date().toISOString().split('T')[0];
  const dataFim = params.get('dataFim') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  console.log(`🔍 Consultando disponibilidade - Médico: ${medicoNome || medicoId}, Período: ${dataInicio} a ${dataFim}`);

  let doctorId = medicoId;

  // Se foi passado nome do médico, buscar o ID
  if (!doctorId && medicoNome) {
    const { data: doctor } = await supabase
      .from('medicos')
      .select('id, nome')
      .ilike('nome', `%${medicoNome}%`)
      .eq('ativo', true)
      .maybeSingle();

    if (!doctor) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Médico "${medicoNome}" não encontrado ou inativo` 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    doctorId = doctor.id;
  }

  if (!doctorId) {
    return new Response(
      JSON.stringify({ success: false, error: 'medicoId ou medicoNome é obrigatório' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Buscar informações do médico
    const { data: doctor, error: doctorError } = await supabase
      .from('medicos')
      .select('*')
      .eq('id', doctorId)
      .eq('ativo', true)
      .single();

    if (doctorError || !doctor) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Médico não encontrado ou inativo' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar agendamentos ocupados no período
    const { data: occupiedSlots, error: slotsError } = await supabase
      .from('agendamentos')
      .select('data_agendamento, hora_agendamento')
      .eq('medico_id', doctorId)
      .gte('data_agendamento', dataInicio)
      .lte('data_agendamento', dataFim)
      .in('status', ['agendado', 'confirmado']);

    if (slotsError) throw slotsError;

    // Buscar bloqueios de agenda
    const { data: blockedPeriods, error: blockError } = await supabase
      .from('bloqueios_agenda')
      .select('data_inicio, data_fim, motivo')
      .eq('medico_id', doctorId)
      .eq('status', 'ativo')
      .or(`data_inicio.lte.${dataFim},data_fim.gte.${dataInicio}`);

    if (blockError) throw blockError;

    // Processar horários de atendimento do médico
    const horarios = doctor.horarios || {};
    const availableSlots = [];

    // Gerar slots disponíveis para cada dia do período
    const startDate = new Date(dataInicio);
    const endDate = new Date(dataFim);
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 0 = domingo, 1 = segunda, etc.
      const dayNames = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
      const dayName = dayNames[dayOfWeek];

      // Verificar se não é no passado
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) continue;

      // Verificar se há horários definidos para este dia
      if (!horarios[dayName] || !horarios[dayName].ativo) continue;

      // Verificar se a data não está bloqueada
      const isBlocked = blockedPeriods.some((block: any) => 
        dateStr >= block.data_inicio && dateStr <= block.data_fim
      );
      if (isBlocked) continue;

      // Gerar slots de 30 em 30 minutos nos horários de atendimento
      const daySchedule = horarios[dayName];
      if (daySchedule.inicio && daySchedule.fim) {
        const [startHour, startMin] = daySchedule.inicio.split(':').map(Number);
        const [endHour, endMin] = daySchedule.fim.split(':').map(Number);
        
        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;
        
        for (let time = startTime; time < endTime; time += 30) {
          const hour = Math.floor(time / 60);
          const min = time % 60;
          const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
          
          // Verificar se este horário não está ocupado
          const isOccupied = occupiedSlots.some((slot: any) => 
            slot.data_agendamento === dateStr && slot.hora_agendamento === timeStr
          );
          
          if (!isOccupied) {
            availableSlots.push({
              data: dateStr,
              hora: timeStr,
              timestamp: `${dateStr}T${timeStr}:00`
            });
          }
        }
      }
    }

    console.log(`✅ Encontrados ${availableSlots.length} horários disponíveis para ${doctor.nome}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          medico: {
            id: doctor.id,
            nome: doctor.nome,
            especialidade: doctor.especialidade
          },
          periodo: {
            inicio: dataInicio,
            fim: dataFim
          },
          horariosDisponiveis: availableSlots,
          totalDisponivel: availableSlots.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    } catch (error) {
      console.error('❌ Erro ao consultar disponibilidade:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor'
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
}