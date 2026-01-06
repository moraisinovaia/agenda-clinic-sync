import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-cliente-id',
};

// Fallback para IPADO (cliente padrão)
const IPADO_CLIENTE_ID = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';

interface AgendamentoRequest {
  paciente_nome: string;
  paciente_data_nascimento: string; // YYYY-MM-DD
  paciente_convenio: string;
  paciente_telefone?: string;
  paciente_celular: string;
  medico_id: string;
  atendimento_id: string;
  data_agendamento: string; // YYYY-MM-DD
  hora_agendamento: string; // HH:MM
  observacoes?: string;
  cliente_id?: string; // Opcional - permite especificar cliente no body
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar API Key
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('N8N_API_KEY');
    
    if (!apiKey || apiKey !== expectedApiKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid API Key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const path = url.pathname.replace('/n8n-api', '');
    const method = req.method;

    // ============= SISTEMA MULTI-CLIENTE =============
    // Prioridade: 1. Header x-cliente-id  2. Query param cliente_id  3. Fallback IPADO
    let cliente_id = req.headers.get('x-cliente-id') || url.searchParams.get('cliente_id');
    
    // Para métodos POST/PUT/DELETE, também verificar no body
    let body: any = null;
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      try {
        const rawBody = await req.text();
        if (rawBody) {
          body = JSON.parse(rawBody);
          // Se cliente_id vier no body, usar (apenas se não veio via header/query)
          if (!cliente_id && body.cliente_id) {
            cliente_id = body.cliente_id;
          }
        }
      } catch (e) {
        // Body vazio ou inválido - continuar sem body
      }
    }
    
    // Fallback para IPADO se nenhum cliente_id foi fornecido
    if (!cliente_id) {
      cliente_id = IPADO_CLIENTE_ID;
      console.log(`⚠️ [N8N-API] cliente_id não fornecido, usando fallback IPADO: ${cliente_id}`);
    } else {
      console.log(`✅ [N8N-API] Usando cliente_id: ${cliente_id}`);
    }

    // ==================== GET /medicos ====================
    if (method === 'GET' && path === '/medicos') {
      const { data, error } = await supabase
        .from('medicos')
        .select('id, nome, especialidade, convenios_aceitos, ativo, horarios')
        .eq('cliente_id', cliente_id)
        .eq('ativo', true);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, medicos: data, cliente_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== GET /atendimentos ====================
    if (method === 'GET' && path === '/atendimentos') {
      const { data, error } = await supabase
        .from('atendimentos')
        .select('id, nome, tipo, codigo, medico_id, ativo')
        .eq('cliente_id', cliente_id)
        .eq('ativo', true);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, atendimentos: data, cliente_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== GET /disponibilidade ====================
    if (method === 'GET' && path === '/disponibilidade') {
      const medico_id = url.searchParams.get('medico_id');
      const data_inicio = url.searchParams.get('data_inicio');
      const data_fim = url.searchParams.get('data_fim');

      if (!medico_id || !data_inicio || !data_fim) {
        return new Response(
          JSON.stringify({ error: 'Parâmetros obrigatórios: medico_id, data_inicio, data_fim' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar agendamentos existentes
      const { data: agendamentos, error } = await supabase
        .from('agendamentos')
        .select('data_agendamento, hora_agendamento')
        .eq('medico_id', medico_id)
        .eq('cliente_id', cliente_id)
        .gte('data_agendamento', data_inicio)
        .lte('data_agendamento', data_fim)
        .in('status', ['agendado', 'confirmado']);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, horarios_ocupados: agendamentos, cliente_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== GET /agenda ====================
    if (method === 'GET' && path === '/agenda') {
      const data = url.searchParams.get('data');
      const medico_id = url.searchParams.get('medico_id');

      let query = supabase
        .from('agendamentos')
        .select(`
          id,
          data_agendamento,
          hora_agendamento,
          status,
          observacoes,
          convenio,
          pacientes:paciente_id (nome_completo, celular, data_nascimento),
          medicos:medico_id (nome, especialidade),
          atendimentos:atendimento_id (nome, tipo)
        `)
        .eq('cliente_id', cliente_id);

      if (data) query = query.eq('data_agendamento', data);
      if (medico_id) query = query.eq('medico_id', medico_id);

      const { data: agendamentos, error } = await query.order('data_agendamento', { ascending: true }).order('hora_agendamento', { ascending: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, agendamentos, cliente_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== POST /agendamento ====================
    if (method === 'POST' && path === '/agendamento') {
      // body já foi parseado acima
      const reqBody: AgendamentoRequest = body;

      // Validar campos obrigatórios
      if (!reqBody.paciente_nome || !reqBody.paciente_data_nascimento || !reqBody.paciente_convenio || 
          !reqBody.paciente_celular || !reqBody.medico_id || !reqBody.atendimento_id || 
          !reqBody.data_agendamento || !reqBody.hora_agendamento) {
        return new Response(
          JSON.stringify({ error: 'Campos obrigatórios faltando' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar ou criar paciente
      const { data: pacienteExistente } = await supabase
        .from('pacientes')
        .select('id')
        .eq('nome_completo', reqBody.paciente_nome)
        .eq('data_nascimento', reqBody.paciente_data_nascimento)
        .eq('cliente_id', cliente_id)
        .maybeSingle();

      let paciente_id: string;

      if (pacienteExistente) {
        paciente_id = pacienteExistente.id;
      } else {
        const { data: novoPaciente, error: pacienteError } = await supabase
          .from('pacientes')
          .insert({
            nome_completo: reqBody.paciente_nome.toUpperCase(),
            data_nascimento: reqBody.paciente_data_nascimento,
            convenio: reqBody.paciente_convenio,
            telefone: reqBody.paciente_telefone || '',
            celular: reqBody.paciente_celular,
            cliente_id
          })
          .select()
          .single();

        if (pacienteError) throw pacienteError;
        paciente_id = novoPaciente.id;
      }

      // Criar agendamento
      const { data: agendamento, error: agendamentoError } = await supabase
        .from('agendamentos')
        .insert({
          paciente_id,
          medico_id: reqBody.medico_id,
          atendimento_id: reqBody.atendimento_id,
          data_agendamento: reqBody.data_agendamento,
          hora_agendamento: reqBody.hora_agendamento,
          convenio: reqBody.paciente_convenio,
          observacoes: reqBody.observacoes || '',
          criado_por: 'n8n_agent',
          status: 'agendado',
          cliente_id
        })
        .select()
        .single();

      if (agendamentoError) throw agendamentoError;

      return new Response(
        JSON.stringify({ success: true, agendamento, cliente_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== PUT /agendamento/:id ====================
    if (method === 'PUT' && path.startsWith('/agendamento/')) {
      const agendamento_id = path.split('/')[2];
      // body já foi parseado acima

      const updateData: any = {};
      if (body?.data_agendamento) updateData.data_agendamento = body.data_agendamento;
      if (body?.hora_agendamento) updateData.hora_agendamento = body.hora_agendamento;
      if (body?.observacoes !== undefined) updateData.observacoes = body.observacoes;

      const { data, error } = await supabase
        .from('agendamentos')
        .update(updateData)
        .eq('id', agendamento_id)
        .eq('cliente_id', cliente_id)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, agendamento: data, cliente_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== DELETE /agendamento/:id ====================
    if (method === 'DELETE' && path.startsWith('/agendamento/')) {
      const agendamento_id = path.split('/')[2];

      const { data, error } = await supabase
        .from('agendamentos')
        .update({ status: 'cancelado', cancelado_por: 'n8n_agent' })
        .eq('id', agendamento_id)
        .eq('cliente_id', cliente_id)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, agendamento: data, cliente_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rota não encontrada
    return new Response(
      JSON.stringify({ error: 'Rota não encontrada' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
