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
    
    console.log(`📊 Clinic Data API: ${method} ${url.pathname}`);

    // GET /clinic-data/doctors - Listar médicos ativos
    if (method === 'GET' && pathParts[1] === 'doctors') {
      const { data: doctors, error } = await supabase
        .from('medicos')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: doctors }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /clinic-data/services - Listar tipos de atendimento ativos
    if (method === 'GET' && pathParts[1] === 'services') {
      const { data: services, error } = await supabase
        .from('atendimentos')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: services }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /clinic-data/services/by-doctor/:doctorId - Atendimentos por médico
    if (method === 'GET' && pathParts[1] === 'services' && pathParts[2] === 'by-doctor' && pathParts[3]) {
      const doctorId = pathParts[3];
      
      const { data: services, error } = await supabase
        .from('atendimentos')
        .select('*')
        .eq('medico_id', doctorId)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: services }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /clinic-data/availability?doctorId=xxx&date=YYYY-MM-DD - Verificar disponibilidade
    if (method === 'GET' && pathParts[1] === 'availability') {
      const doctorId = url.searchParams.get('doctorId');
      const date = url.searchParams.get('date');

      if (!doctorId || !date) {
        return new Response(
          JSON.stringify({ success: false, error: 'doctorId e date são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar agendamentos existentes para a data
      const { data: appointments, error } = await supabase
        .from('agendamentos')
        .select('hora_agendamento, status')
        .eq('medico_id', doctorId)
        .eq('data_agendamento', date)
        .in('status', ['agendado', 'confirmado']);

      if (error) throw error;

      // Horários padrão de funcionamento (8h às 18h, intervalos de 30min)
      const workingHours = [];
      for (let hour = 8; hour < 18; hour++) {
        workingHours.push(`${hour.toString().padStart(2, '0')}:00`);
        workingHours.push(`${hour.toString().padStart(2, '0')}:30`);
      }

      // Marcar horários ocupados
      const occupiedTimes = appointments.map(apt => apt.hora_agendamento);
      const availability = workingHours.map(time => ({
        time,
        available: !occupiedTimes.includes(time)
      }));

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: {
            date,
            doctorId,
            slots: availability,
            totalSlots: availability.length,
            availableSlots: availability.filter(slot => slot.available).length
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /clinic-data/patients/search?nome=xxx&nascimento=YYYY-MM-DD - Buscar pacientes
    if (method === 'GET' && pathParts[1] === 'patients' && pathParts[2] === 'search') {
      const nome = url.searchParams.get('nome');
      const nascimento = url.searchParams.get('nascimento');

      if (!nome || !nascimento) {
        return new Response(
          JSON.stringify({ success: false, error: 'nome e nascimento são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: patients, error } = await supabase
        .from('pacientes')
        .select('*')
        .ilike('nome_completo', `%${nome}%`)
        .eq('data_nascimento', nascimento)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Remover duplicatas baseado no nome completo e convênio
      const uniquePatients = patients ? patients.reduce((acc, current) => {
        const existing = acc.find(patient => 
          patient.nome_completo.toLowerCase() === current.nome_completo.toLowerCase() &&
          patient.convenio === current.convenio
        );
        if (!existing) {
          acc.push(current);
        }
        return acc;
      }, [] as typeof patients) : [];

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: uniquePatients,
          found: uniquePatients.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /clinic-data/appointments/by-date?date=YYYY-MM-DD&doctorId=xxx - Agendamentos por data
    if (method === 'GET' && pathParts[1] === 'appointments' && pathParts[2] === 'by-date') {
      const date = url.searchParams.get('date');
      const doctorId = url.searchParams.get('doctorId');

      let query = supabase
        .from('agendamentos')
        .select(`
          *,
          pacientes:paciente_id(*),
          medicos:medico_id(*),
          atendimentos:atendimento_id(*)
        `)
        .order('hora_agendamento', { ascending: true });

      if (date) {
        query = query.eq('data_agendamento', date);
      }

      if (doctorId) {
        query = query.eq('medico_id', doctorId);
      }

      const { data: appointments, error } = await query;

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: appointments }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /clinic-data/preparos - Listar preparos de exames
    if (method === 'GET' && pathParts[1] === 'preparos') {
      const { data: preparos, error } = await supabase
        .from('preparos')
        .select('*')
        .order('nome');

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: preparos }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /clinic-data/valores - Listar valores de procedimentos
    if (method === 'GET' && pathParts[1] === 'valores') {
      const { data: valores, error } = await supabase
        .from('valores_procedimentos')
        .select('*')
        .order('categoria', { ascending: true })
        .order('procedimento', { ascending: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: valores }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /clinic-data/alimentos - Listar alimentos para teste de hidrogênio
    if (method === 'GET' && pathParts[1] === 'alimentos') {
      const { data: alimentos, error } = await supabase
        .from('alimentos_teste_hidrogenio')
        .select('*')
        .order('categoria');

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: alimentos }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /clinic-data/questionario - Listar questionário pré-colonoscopia
    if (method === 'GET' && pathParts[1] === 'questionario') {
      const { data: questionario, error } = await supabase
        .from('questionario_pre_colonoscopia')
        .select('*')
        .order('ordem', { ascending: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: questionario }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Endpoint não encontrado' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na API de dados da clínica:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})