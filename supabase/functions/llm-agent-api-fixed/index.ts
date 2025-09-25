import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ScheduleRequest {
  patient_name: string;
  birth_date: string; 
  insurance: string;
  phone?: string;
  cell_phone: string;
  doctor_name: string;
  service_name: string;
  appointment_date: string;
  appointment_time: string;
  observations?: string;
}

interface CheckPatientRequest {
  patient_name: string;
  birth_date?: string;
  phone?: string;
}

interface RescheduleRequest {
  appointment_id: string;
  new_date: string;
  new_time: string;
  reason?: string;
}

interface CancelRequest {
  appointment_id: string;
  reason: string;
}

interface AvailabilityRequest {
  doctor_name: string;
  date: string;
  service_name?: string;
}

interface PatientSearchRequest {
  search_term: string;
}

serve(async (req) => {
  console.log('🤖 LLM Agent API called');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const url = new URL(req.url);
    const endpoint = url.pathname.split('/').pop();
    
    console.log(`📍 Endpoint: ${endpoint}`);

    if (req.method === 'POST') {
      const body = await req.json();
      
      switch (endpoint) {
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
          return errorResponse('Endpoint não encontrado');
      }
    }

    return errorResponse('Método não permitido. Use POST.');

  } catch (error) {
    console.error('❌ Erro na LLM Agent API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return errorResponse(`Erro interno: ${errorMessage}`);
  }
})

async function handleSchedule(supabase: any, body: ScheduleRequest) {
  try {
    console.log('📅 Criar agendamento:', body);
    
    const {
      patient_name,
      birth_date,
      insurance,
      phone,
      cell_phone,
      doctor_name,
      service_name,
      appointment_date,
      appointment_time,
      observations
    } = body;

    // Validações básicas
    if (!patient_name || !birth_date || !insurance || !cell_phone || 
        !doctor_name || !service_name || !appointment_date || !appointment_time) {
      return errorResponse('Campos obrigatórios faltando');
    }

    // Buscar médico
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('*')
      .ilike('nome', `%${doctor_name}%`)
      .eq('ativo', true)
      .single();

    if (medicoError || !medico) {
      return errorResponse(`Médico "${doctor_name}" não encontrado`);
    }

    // Buscar atendimento/serviço  
    const { data: atendimento, error: atendimentoError } = await supabase
      .from('atendimentos')
      .select('*')
      .ilike('nome', `%${service_name}%`)
      .eq('ativo', true)
      .single();

    if (atendimentoError || !atendimento) {
      return errorResponse(`Serviço "${service_name}" não encontrado`);
    }

    // Chamar função atomica de agendamento
    const { data: result, error: scheduleError } = await supabase
      .rpc('criar_agendamento_atomico', {
        p_nome_completo: patient_name,
        p_data_nascimento: birth_date,
        p_convenio: insurance,
        p_telefone: phone || '',
        p_celular: cell_phone,
        p_medico_id: medico.id,
        p_atendimento_id: atendimento.id,
        p_data_agendamento: appointment_date,
        p_hora_agendamento: appointment_time,
        p_observacoes: observations || '',
        p_criado_por: 'llm_agent'
      });

    if (scheduleError) {
      console.error('Erro ao criar agendamento:', scheduleError);
      return errorResponse('Erro ao processar agendamento');
    }

    if (!result?.success) {
      return errorResponse(result?.message || result?.error || 'Erro desconhecido no agendamento');
    }

    return successResponse({
      message: 'Agendamento criado com sucesso',
      appointment_id: result.agendamento_id,
      patient_name,
      doctor_name: medico.nome,
      service_name: atendimento.nome,
      appointment_date,
      appointment_time,
      insurance
    });
    
  } catch (error) {
    console.error('❌ Erro ao processar agendamento:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return errorResponse(`Erro ao processar agendamento: ${errorMessage}`);
  }
}

async function handleCheckPatient(supabase: any, body: CheckPatientRequest) {
  try {
    console.log('🔍 Verificar paciente:', body);
    
    const { patient_name, birth_date, phone } = body;
    
    if (!patient_name) {
      return errorResponse('Nome do paciente é obrigatório');
    }

    // Buscar pacientes
    let query = supabase
      .from('pacientes')
      .select('*');

    if (birth_date && phone) {
      query = query.or(`nome_completo.ilike.%${patient_name}%,and(data_nascimento.eq.${birth_date},or(telefone.ilike.%${phone}%,celular.ilike.%${phone}%))`);
    } else if (birth_date) {
      query = query.and(`nome_completo.ilike.%${patient_name}%,data_nascimento.eq.${birth_date}`);
    } else if (phone) {
      query = query.and(`nome_completo.ilike.%${patient_name}%,or(telefone.ilike.%${phone}%,celular.ilike.%${phone}%)`);
    } else {
      query = query.ilike('nome_completo', `%${patient_name}%`);
    }

    const { data: pacientes, error: pacientesError } = await query.limit(5);

    if (pacientesError) {
      console.error('Erro ao buscar pacientes:', pacientesError);
      return errorResponse('Erro ao buscar pacientes');
    }

    if (!pacientes || pacientes.length === 0) {
      return successResponse({
        message: 'Nenhum paciente encontrado',
        appointments: [],
        total: 0
      });
    }

    // Buscar agendamentos dos pacientes encontrados
    const paciente_ids = pacientes.map((p: any) => p.id);
    
    const { data: agendamentos, error: agendError } = await supabase
      .from('agendamentos')
      .select(`
        *,
        medicos (nome),
        atendimentos (nome)
      `)
      .in('paciente_id', paciente_ids)
      .gte('data_agendamento', new Date().toISOString().split('T')[0])
      .order('data_agendamento', { ascending: true });

    if (agendError) {
      console.error('Erro ao buscar agendamentos:', agendError);
      return errorResponse('Erro ao buscar agendamentos');
    }

    // Filtrar apenas agendamentos futuros ou do dia atual
    let filteredAgendamentos = agendamentos || [];
    
    // Se há data de nascimento, filtrar por pacientes com essa data
    if (birth_date) {
      const validPatients = pacientes.filter((p: any) => p.data_nascimento === birth_date);
      const validPatientIds = validPatients.map((p: any) => p.id);
      filteredAgendamentos = filteredAgendamentos.filter((a: any) =>
        validPatientIds.includes(a.paciente_id)
      );
    }

    // Se há telefone, filtrar por pacientes com esse telefone
    if (phone) {
      const validPatients = pacientes.filter((p: any) => 
        (p.telefone && p.telefone.includes(phone)) || 
        (p.celular && p.celular.includes(phone))
      );
      const validPatientIds = validPatients.map((p: any) => p.id);
      filteredAgendamentos = filteredAgendamentos.filter((a: any) =>
        validPatientIds.includes(a.paciente_id)
      );
    }

    const consultas = filteredAgendamentos.map((a: any) => ({
      appointment_id: a.id,
      appointment_date: a.data_agendamento,
      appointment_time: a.hora_agendamento,
      doctor_name: a.medicos?.nome,
      service_name: a.atendimentos?.nome,
      status: a.status,
      observations: a.observacoes
    }));

    return successResponse({
      message: `Encontrados ${consultas.length} agendamentos para ${patient_name}`,
      appointments: consultas,
      total: consultas.length,
      patient_name
    });
    
  } catch (error) {
    console.error('❌ Erro ao verificar paciente:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return errorResponse(`Erro ao verificar paciente: ${errorMessage}`);
  }
}

async function handleReschedule(supabase: any, body: RescheduleRequest) {
  try {
    console.log('🔄 Remarcar agendamento:', body);
    
    const { appointment_id, new_date, new_time, reason } = body;
    
    if (!appointment_id || !new_date || !new_time) {
      return errorResponse('Campos obrigatórios: appointment_id, new_date, new_time');
    }
    
    // Atualizar agendamento
    const { error: updateError } = await supabase
      .from('agendamentos')
      .update({
        data_agendamento: new_date,
        hora_agendamento: new_time,
        observacoes: reason ? `Remarcado: ${reason}` : 'Remarcado via WhatsApp',
        updated_at: new Date().toISOString()
      })
      .eq('id', appointment_id);
    
    if (updateError) {
      console.error('Erro ao remarcar:', updateError);
      return errorResponse('Erro ao remarcar agendamento');
    }
    
    return successResponse({
      message: 'Agendamento remarcado com sucesso',
      appointment_id,
      new_date,
      new_time,
      reason: reason || 'Não informado'
    });
    
  } catch (error) {
    console.error('❌ Erro ao remarcar consulta:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return errorResponse(`Erro ao remarcar consulta: ${errorMessage}`);
  }
}

async function handleCancel(supabase: any, body: CancelRequest) {
  try {
    console.log('❌ Cancelar agendamento:', body);
    
    const { appointment_id, reason } = body;
    
    if (!appointment_id || !reason) {
      return errorResponse('Campos obrigatórios: appointment_id, reason');
    }
    
    // Cancelar agendamento
    const { error: cancelError } = await supabase
      .from('agendamentos')
      .update({
        status: 'cancelado',
        cancelado_em: new Date().toISOString(),
        cancelado_por: 'whatsapp_agent',
        observacoes: `Cancelado: ${reason}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', appointment_id);
    
    if (cancelError) {
      console.error('Erro ao cancelar:', cancelError);
      return errorResponse('Erro ao cancelar agendamento');
    }
    
    return successResponse({
      message: 'Agendamento cancelado com sucesso',
      appointment_id,
      reason
    });
    
  } catch (error) {
    console.error('❌ Erro ao cancelar consulta:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return errorResponse(`Erro ao cancelar consulta: ${errorMessage}`);
  }
}

async function handleAvailability(supabase: any, body: AvailabilityRequest) {
  try {
    console.log('📅 Verificar disponibilidade:', body);
    
    const { doctor_name, date, service_name } = body;
    
    if (!doctor_name || !date) {
      return errorResponse('Campos obrigatórios: doctor_name, date');
    }
    
    // Buscar médico
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('*')
      .ilike('nome', `%${doctor_name}%`)
      .eq('ativo', true)
      .single();
    
    if (medicoError || !medico) {
      return errorResponse(`Médico "${doctor_name}" não encontrado`);
    }
    
    // Buscar agendamentos do dia
    const { data: agendamentos, error: agendError } = await supabase
      .from('agendamentos')
      .select('hora_agendamento')
      .eq('medico_id', medico.id)
      .eq('data_agendamento', date)
      .in('status', ['agendado', 'confirmado']);
    
    if (agendError) {
      console.error('Erro ao buscar agendamentos:', agendError);
      return errorResponse('Erro ao verificar agendamentos');
    }
    
    const horariosOcupados = agendamentos?.map((a: any) => a.hora_agendamento) || [];
    
    // Horários padrão
    const horariosPadrao = [
      '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
      '11:00', '11:30', '13:00', '13:30', '14:00', '14:30',
      '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
    ];
    
    const horariosDisponiveis = horariosPadrao.filter(
      horario => !horariosOcupados.includes(horario)
    );
    
    return successResponse({
      doctor_name: medico.nome,
      date,
      available_slots: horariosDisponiveis,
      total_available: horariosDisponiveis.length,
      service_name: service_name || 'Não especificado'
    });
    
  } catch (error) {
    console.error('❌ Erro ao verificar disponibilidade:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return errorResponse(`Erro ao verificar disponibilidade: ${errorMessage}`);
  }
}

async function handlePatientSearch(supabase: any, body: PatientSearchRequest) {
  try {
    console.log('🔍 Buscar pacientes:', body);
    
    const { search_term } = body;
    
    if (!search_term) {
      return errorResponse('Campo obrigatório: search_term');
    }
    
    // Buscar pacientes
    const { data: pacientes, error } = await supabase
      .from('pacientes')
      .select('*')
      .or(`nome_completo.ilike.%${search_term}%,telefone.ilike.%${search_term}%,celular.ilike.%${search_term}%`)
      .limit(10);
    
    if (error) {
      console.error('Erro ao buscar pacientes:', error);
      return errorResponse('Erro ao buscar pacientes');
    }
    
    return successResponse({
      patients: pacientes || [],
      total_found: pacientes?.length || 0,
      search_term
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar pacientes:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return errorResponse(`Erro ao buscar pacientes: ${errorMessage}`);
  }
}

function successResponse(data: any) {
  return new Response(
    JSON.stringify({ success: true, ...data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function errorResponse(message: string) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}