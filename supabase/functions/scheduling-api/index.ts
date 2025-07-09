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
    
    console.log(`📞 N8N API Call: ${method} ${url.pathname}`);

    // GET /scheduling-api - Listar agendamentos
    if (method === 'GET' && pathParts.length === 1) {
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

    // POST /scheduling-api - Criar agendamento
    if (method === 'POST' && pathParts.length === 1) {
      const body = await req.json();
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
        observacoes 
      } = body;

      // Validações
      if (!nomeCompleto || !dataNascimento || !convenio || !celular || !medicoId || !atendimentoId || !dataAgendamento || !horaAgendamento) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Campos obrigatórios: nomeCompleto, dataNascimento, convenio, celular, medicoId, atendimentoId, dataAgendamento, horaAgendamento' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar conflito de horário
      const { data: conflictCheck } = await supabase
        .from('agendamentos')
        .select('id')
        .eq('medico_id', medicoId)
        .eq('data_agendamento', dataAgendamento)
        .eq('hora_agendamento', horaAgendamento)
        .eq('status', 'agendado')
        .maybeSingle();

      if (conflictCheck) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Este horário já está ocupado para o médico selecionado' 
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar paciente existente por nome e data de nascimento
      let pacienteId = null;
      const { data: existingPatients } = await supabase
        .from('pacientes')
        .select('id')
        .ilike('nome_completo', nomeCompleto)
        .eq('data_nascimento', dataNascimento)
        .eq('convenio', convenio);

      if (existingPatients && existingPatients.length > 0) {
        pacienteId = existingPatients[0].id;
        console.log('✅ Paciente encontrado:', pacienteId);
      } else {
        // Criar novo paciente
        const { data: newPatient, error: patientError } = await supabase
          .from('pacientes')
          .insert({
            nome_completo: nomeCompleto,
            data_nascimento: dataNascimento,
            convenio: convenio,
            telefone: telefone || null,
            celular: celular,
          })
          .select()
          .single();

        if (patientError) throw patientError;
        pacienteId = newPatient.id;
        console.log('✅ Novo paciente criado:', pacienteId);
      }

      // Criar agendamento
      const { data: appointment, error: appointmentError } = await supabase
        .from('agendamentos')
        .insert({
          paciente_id: pacienteId,
          medico_id: medicoId,
          atendimento_id: atendimentoId,
          data_agendamento: dataAgendamento,
          hora_agendamento: horaAgendamento,
          observacoes: observacoes,
          criado_por: 'n8n_agent',
        })
        .select(`
          *,
          pacientes:paciente_id(*),
          medicos:medico_id(*),
          atendimentos:atendimento_id(*)
        `)
        .single();

      if (appointmentError) throw appointmentError;

      console.log('✅ Agendamento criado:', appointment.id);
      return new Response(
        JSON.stringify({ success: true, data: appointment }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT /scheduling-api/:id - Remarcar agendamento
    if (method === 'PUT' && pathParts.length === 2) {
      const appointmentId = pathParts[1];
      const body = await req.json();
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
    if (method === 'PATCH' && pathParts.length === 3 && pathParts[2] === 'status') {
      const appointmentId = pathParts[1];
      const body = await req.json();
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

    return new Response(
      JSON.stringify({ success: false, error: 'Endpoint não encontrado' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na API:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})