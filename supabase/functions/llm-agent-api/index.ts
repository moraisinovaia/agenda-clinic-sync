import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { corsHeaders, API_VERSION, errorResponse } from './_lib/responses.ts'
import { generateRequestId, structuredLog, METRICS, withLogging } from './_lib/logging.ts'
import { loadDynamicConfig } from './_lib/config.ts'

import { handleSchedule } from './_handlers/schedule.ts'
import { handleListAppointments } from './_handlers/list-appointments.ts'
import { handleCheckPatient } from './_handlers/check-patient.ts'
import { handleReschedule } from './_handlers/reschedule.ts'
import { handleCancel } from './_handlers/cancel.ts'
import { handleConsultarFila, handleAdicionarFila, handleResponderFila } from './_handlers/fila-espera.ts'
import { handleConfirm } from './_handlers/confirm.ts'
import { handleAvailability } from './_handlers/availability.ts'
import { handlePatientSearch } from './_handlers/patient-search.ts'
import { handleDoctorSchedules } from './_handlers/doctor-schedules.ts'
import { handleListDoctors } from './_handlers/list-doctors.ts'
import { handleClinicInfo } from './_handlers/clinic-info.ts'

serve(async (req) => {
  const requestId = generateRequestId();
  const apiStartTime = performance.now();

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validar API Key
  const apiKey = req.headers.get('x-api-key');
  const expectedApiKey = Deno.env.get('N8N_API_KEY');
  if (!apiKey || apiKey !== expectedApiKey) {
    console.error('❌ Unauthorized: Invalid or missing API key');
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Invalid API Key' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const method = req.method;
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Log inicial estruturado
    structuredLog({
      timestamp: new Date().toISOString(),
      request_id: requestId,
      cliente_id: 'pending',
      action: 'api_call',
      level: 'info',
      phase: 'request',
      metadata: {
        version: API_VERSION,
        method,
        path: url.pathname,
        uptime_ms: Date.now() - METRICS.start_time,
        total_requests_so_far: METRICS.total_requests
      }
    });

    console.log(`🤖 LLM Agent API v${API_VERSION} [${requestId}] ${method} ${url.pathname}`);

    if (method === 'POST') {
      let body = await req.json();

      // 🔍 DEBUG SANITIZADO: preservar observabilidade sem expor payload completo
      console.log('📥 [DEBUG] Tipo do body:', typeof body);
      console.log('📥 [DEBUG] É array?:', Array.isArray(body));
      if (body) {
        console.log('📥 [DEBUG] Keys do body:', Object.keys(body));
      }

      // ✅ Normalizar body se for array (n8n às vezes envia [{...}] ao invés de {...})
      if (Array.isArray(body) && body.length > 0) {
        console.log('⚠️ Body recebido como array, extraindo primeiro elemento');
        body = body[0];
      }

      console.log('📤 [DEBUG] Body normalizado:', {
        is_array: Array.isArray(body),
        keys: body && typeof body === 'object' ? Object.keys(body) : [],
        has_cliente_id: !!body?.cliente_id,
        has_config_id: !!body?.config_id,
        has_doctor_scope: !!(body?.allowed_doctor_ids || body?.doctor_scope || body?.medico_ids_permitidos),
        has_medico_id: !!body?.medico_id,
        has_medico_nome: !!body?.medico_nome,
        has_paciente_nome: !!body?.paciente_nome,
      });

      const rawAction = pathParts[1]; // /llm-agent-api/{action}

      // 🇧🇷 MAPEAMENTO PORTUGUÊS → INGLÊS (aceita ambos os formatos)
      const actionMap: Record<string, string> = {
        'agendar': 'schedule',
        'verificar-paciente': 'check-patient',
        'remarcar': 'reschedule',
        'cancelar': 'cancel',
        'confirmar': 'confirm',
        'disponibilidade': 'availability',
        'pesquisa-pacientes': 'patient-search',
        'lista-consultas': 'list-appointments',
        'lista-medicos': 'list-doctors',
        'info-clinica': 'clinic-info'
      };
      const action = actionMap[rawAction] || rawAction;

      if (actionMap[rawAction]) {
        console.log(`🔄 [I18N] Action mapeada: ${rawAction} → ${action}`);
      }

      // 🔑 MULTI-CLIENTE: requer identificação explícita do tenant
      // cliente_id: obrigatório para isolar todas as queries dos handlers
      // config_id: opcional para apontar uma configuração específica (ex: filial)
      const CLIENTE_ID = body.cliente_id;
      const CONFIG_ID = body.config_id; // Se fornecido, usa config específica

      if (!CLIENTE_ID) {
        return new Response(
          JSON.stringify({ error: 'cliente_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Identificar origem da requisição
      const isProxy = !!body.cliente_id || !!body.config_id;

      console.log(`🏥 Cliente ID: ${CLIENTE_ID}${isProxy ? ' [via proxy]' : ''}`);
      if (CONFIG_ID) {
        console.log(`🔧 Config ID: ${CONFIG_ID} (filial específica)`);
      }

      // 🆕 CARREGAR CONFIGURAÇÃO DINÂMICA DO BANCO
      // Se config_id foi fornecido, carrega config específica (ex: Orion)
      // Senão, busca primeira config ativa do cliente_id
      const dynamicConfig = await loadDynamicConfig(supabase, CLIENTE_ID, CONFIG_ID);

      // Nome do cliente vem do banco (sem hardcodes)
      const clienteNome = dynamicConfig?.clinic_info?.nome_clinica || 'Cliente';

      if (dynamicConfig?.clinic_info) {
        console.log(`✅ Config carregada: ${clienteNome}`);
      } else {
        console.log(`⚠️ Sem configuração no banco para cliente ${CLIENTE_ID}`);
      }

      switch (action) {
        case 'schedule':
          return await withLogging('schedule', CLIENTE_ID, requestId, body,
            () => handleSchedule(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'check-patient':
          return await withLogging('check-patient', CLIENTE_ID, requestId, body,
            () => handleCheckPatient(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'reschedule':
          return await withLogging('reschedule', CLIENTE_ID, requestId, body,
            () => handleReschedule(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'cancel':
          return await withLogging('cancel', CLIENTE_ID, requestId, body,
            () => handleCancel(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'confirm':
          return await withLogging('confirm', CLIENTE_ID, requestId, body,
            () => handleConfirm(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'availability':
          return await withLogging('availability', CLIENTE_ID, requestId, body,
            () => handleAvailability(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'patient-search':
          return await withLogging('patient-search', CLIENTE_ID, requestId, body,
            () => handlePatientSearch(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'list-appointments':
          return await withLogging('list-appointments', CLIENTE_ID, requestId, body,
            () => handleListAppointments(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'list-doctors':
          return await withLogging('list-doctors', CLIENTE_ID, requestId, body,
            () => handleListDoctors(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'clinic-info':
          return await withLogging('clinic-info', CLIENTE_ID, requestId, body,
            () => handleClinicInfo(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'doctor-schedules':
        case 'horarios-medicos':
          return await withLogging('doctor-schedules', CLIENTE_ID, requestId, body,
            () => handleDoctorSchedules(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'consultar-fila':
          return await withLogging('consultar-fila', CLIENTE_ID, requestId, body,
            () => handleConsultarFila(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'adicionar-fila':
          return await withLogging('adicionar-fila', CLIENTE_ID, requestId, body,
            () => handleAdicionarFila(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'responder-fila':
          return await withLogging('responder-fila', CLIENTE_ID, requestId, body,
            () => handleResponderFila(supabase, body, CLIENTE_ID, dynamicConfig));
        default:
          structuredLog({
            timestamp: new Date().toISOString(),
            request_id: requestId,
            cliente_id: CLIENTE_ID,
            action: action || 'unknown',
            level: 'warn',
            phase: 'response',
            duration_ms: Math.round(performance.now() - apiStartTime),
            success: false,
            error_code: 'UNKNOWN_ACTION'
          });
          return errorResponse('Ação não reconhecida. Ações disponíveis: schedule, check-patient, reschedule, cancel, confirm, availability, patient-search, list-appointments, list-doctors, clinic-info, doctor-schedules, consultar-fila, adicionar-fila, responder-fila');
      }
    }

    return errorResponse('Método não permitido. Use POST.');

  } catch (error: any) {
    console.error('❌ Erro na LLM Agent API:', error);
    structuredLog({
      timestamp: new Date().toISOString(),
      request_id: requestId,
      cliente_id: 'unknown',
      action: 'api_error',
      level: 'error',
      phase: 'response',
      duration_ms: Math.round(performance.now() - apiStartTime),
      success: false,
      error_code: 'INTERNAL_ERROR',
      metadata: {
        error_message: error?.message,
        error_stack: error?.stack?.substring(0, 500)
      }
    });
    return errorResponse(`Erro interno: ${error?.message || 'Erro desconhecido'}`);
  }
})
