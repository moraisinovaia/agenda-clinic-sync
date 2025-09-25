import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { 
  handleGetAppointments,
  handleCreateAppointment,
  handleUpdateAppointment,
  handleUpdateAppointmentStatus,
  handleCheckAvailability
} from './_lib/routes.ts'

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
      return await handleGetAppointments(supabase);
    }

    // POST /scheduling-api - Criar agendamento
    if (method === 'POST' && pathParts.length === 1) {
      const body = await req.json();
      return await handleCreateAppointment(supabase, body);
    }

    // PUT /scheduling-api/:id - Remarcar agendamento
    if (method === 'PUT' && pathParts.length === 2) {
      const appointmentId = pathParts[1];
      const body = await req.json();
      return await handleUpdateAppointment(supabase, appointmentId, body);
    }

    // PATCH /scheduling-api/:id/status - Alterar status (cancelar/confirmar)
    if (method === 'PATCH' && pathParts.length === 3 && pathParts[2] === 'status') {
      const appointmentId = pathParts[1];
      const body = await req.json();
      return await handleUpdateAppointmentStatus(supabase, appointmentId, body);
    }

    // GET /scheduling-api/availability - Consultar horários vagos
    if (method === 'GET' && pathParts.length === 2 && pathParts[1] === 'availability') {
      return await handleCheckAvailability(supabase, url.searchParams);
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Endpoint não encontrado' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro na API:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})