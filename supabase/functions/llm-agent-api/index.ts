import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { corsHeaders, API_VERSION, errorResponse } from './_lib/responses.ts'
import { generateRequestId, structuredLog, METRICS, withLogging, getMetricsSnapshot, sanitizeStack } from './_lib/logging.ts'
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
import { handleChat } from './_handlers/chat.ts'
import { handleValidateConfig, handleInvalidateConfig } from './_handlers/admin.ts'
import { resolveAuth, enforceTenantBinding } from './_lib/auth.ts'
import { checkRateLimit } from './_lib/rate-limit.ts'
import {
  validateAvailabilityRequest,
  validateScheduleRequest,
  validateAgendamentoIdRequest,
  validateChatRequest,
  validateFilaRequest,
  validatePatientSearchRequest,
  buildSchemaErrorResponse,
} from './_lib/schema-validation.ts'

serve(async (req) => {
  const requestId = generateRequestId();
  const apiStartTime = performance.now();

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // [Sprint 7] Health público — pra uptime monitors externos (UptimeRobot etc).
  // Sem auth: convenção de mercado (K8s liveness, AWS ELB não autenticam health).
  // Não vaza dado interno: /metrics continua autenticado pra snapshot completo.
  // Deep check: 503 se env crítica faltar (deploy mal configurado).
  if (req.method === 'GET') {
    const probeUrl = new URL(req.url);
    const probeLast = probeUrl.pathname.split('/').filter(Boolean).pop();
    if (probeLast === 'health') {
      const envOk = !!Deno.env.get('SUPABASE_URL')
        && !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        && !!Deno.env.get('OPENAI_API_KEY');
      return new Response(
        JSON.stringify({ status: envOk ? 'ok' : 'degraded', version: API_VERSION }),
        { status: envOk ? 200 : 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  }

  // [F1.1] Auth multi-tenant: resolve cliente_id da KEY (api_keys.key_hash).
  // Backwards compat: env N8N_API_KEY ainda funciona como key global enquanto
  // tenants migram pra api_keys.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const apiKey = req.headers.get('x-api-key');
  const auth = await resolveAuth(supabase, apiKey);
  if (!auth.ok) {
    console.error(`❌ Unauthorized [${auth.reason}]`);
    return new Response(
      JSON.stringify({ error: auth.message }),
      { status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {

    const url = new URL(req.url);
    const method = req.method;
    const pathParts = url.pathname.split('/').filter(Boolean);

    // [Sprint 2.2 + F1.2] Metrics endpoint — GET /metrics (autenticado).
    // Retorna snapshot agregado da instância. Tenants em mode='tenant_key'
    // veem APENAS suas próprias métricas (filtrado por cliente_id da key).
    // Modo legacy global (admin/operação) vê tudo.
    // (/health é público e tratado bem antes — early-return acima do resolveAuth.)
    const lastSegment = pathParts[pathParts.length - 1];
    if (method === 'GET' && lastSegment === 'metrics') {
      const fullSnapshot = getMetricsSnapshot() as any;
      const snapshot = auth.mode === 'tenant_key' && auth.clienteId
        ? {
            healthy:        fullSnapshot.healthy,
            uptime_ms:      fullSnapshot.uptime_ms,
            uptime_human:   fullSnapshot.uptime_human,
            // Não expor totais globais nem por_action global pro tenant — só o seu
            by_cliente:     (fullSnapshot.by_cliente as any[]).filter((c) => c.cliente_id === auth.clienteId),
          }
        : fullSnapshot;
      return new Response(JSON.stringify(snapshot, null, 2), {
        status: snapshot.healthy === false ? 503 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
      let body: any;
      try {
        body = await req.json();
      } catch (parseErr) {
        return new Response(
          JSON.stringify({ error: 'Body deve ser JSON válido', codigo_erro: 'BODY_INVALIDO' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // [F-2] Normalização defensiva. n8n às vezes manda array [{...}] ou
      // [null] ou null em vez de {...}. Antes:
      //   - body=[]: passa, vira "Object.keys(body).length === 0" → 400 OK
      //   - body=[null]: vira null após extract → Object.keys(null) lança TypeError
      //   - body=null: idem
      // Agora todos esses caem em 400 estruturado antes de qualquer log/debug.
      if (Array.isArray(body)) {
        if (body.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Body é array vazio', codigo_erro: 'BODY_INVALIDO' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
        console.log('⚠️ Body recebido como array, extraindo primeiro elemento');
        body = body[0];
      }
      if (!body || typeof body !== 'object') {
        return new Response(
          JSON.stringify({ error: 'Body deve ser objeto JSON', codigo_erro: 'BODY_INVALIDO' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // 🔍 DEBUG SANITIZADO (após normalização)
      console.log('📥 [DEBUG] Body keys:', Object.keys(body));

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
        'info-clinica': 'clinic-info',
        'chat': 'chat',
        'validar-config': 'validate-config',
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

      // [F9.1] Validação de schema ANTES de qualquer query (evita gastar
      // ciclos com body malformado). Antes ficava após loadDynamicConfig,
      // mas isso fazia "not-a-uuid" cair em CONFIG_INDISPONIVEL em vez do
      // erro estruturado SCHEMA_INVALIDO. Validar primeiro = fail-fast.
      const SCHEMA_VALIDATORS_EARLY: Record<string, (b: any) => any[]> = {
        'availability':     validateAvailabilityRequest,
        'schedule':         validateScheduleRequest,
        'reschedule':       validateAgendamentoIdRequest,
        'cancel':           validateAgendamentoIdRequest,
        'confirm':          validateAgendamentoIdRequest,
        // [M1] cobertura adicional pra endpoints que faltavam
        'chat':             validateChatRequest,
        'consultar-fila':   validateFilaRequest,
        'adicionar-fila':   validateFilaRequest,
        'responder-fila':   validateFilaRequest,
        'patient-search':   validatePatientSearchRequest,
      };
      const earlyValidator = SCHEMA_VALIDATORS_EARLY[action];
      if (earlyValidator) {
        const errs = earlyValidator(body);
        if (errs.length > 0) {
          return buildSchemaErrorResponse(errs, corsHeaders);
        }
      }

      // [F1.4] Rate limit por cliente_id (token bucket in-memory).
      // Default: 60 req/min com burst 20. Configurável via RATE_LIMIT_PER_MIN/RATE_LIMIT_BURST.
      const rl = checkRateLimit(CLIENTE_ID);
      if (!rl.allowed) {
        console.warn(`⏱️ [rate-limit] cliente_id=${CLIENTE_ID} excedeu limite. retry_after=${rl.retryAfterMs}ms`);
        return new Response(
          JSON.stringify({
            error:        'Rate limit excedido',
            codigo_erro:  'RATE_LIMITED',
            retry_after_ms: rl.retryAfterMs,
            mensagem_usuario: 'Muitas requisições em pouco tempo. Tente novamente em alguns segundos.',
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'Retry-After': String(Math.ceil((rl.retryAfterMs ?? 1000) / 1000)),
            },
          },
        );
      }

      // [F1.1] Quando a key é tenant-bound, REJEITA se body.cliente_id divergir.
      // Em modo legacy_global, body.cliente_id é trust (comportamento antigo
      // até todos tenants migrarem pra api_keys).
      const bindingErr = enforceTenantBinding(auth, CLIENTE_ID);
      if (bindingErr) {
        console.error(`❌ Tenant binding violation: key bound to ${auth.clienteId}, body.cliente_id=${CLIENTE_ID}`);
        return new Response(
          JSON.stringify({ error: bindingErr.message, codigo_erro: 'TENANT_MISMATCH' }),
          { status: bindingErr.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (auth.mode === 'legacy_global') {
        console.warn(`⚠️ [auth] legacy global key em uso para cliente_id=${CLIENTE_ID}. Migrar para api_keys table.`);
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
        console.warn(`⚠️ Sem configuração para cliente ${CLIENTE_ID}`);
      }

      // [F2.2] Bloquear handlers de produto quando config indisponível.
      // Antes: silenciosamente degradavam pra business_rules HARDCODED do
      // Dr. Marcelo, fazendo outros tenants pegarem regras erradas (ex: pool
      // Consulta+Retorno de cardiologia em clínica de pediatria).
      // Agora: 503 explícito. `validate-config` ainda roda (é meta-tool de
      // setup) e demais ferramentas admin se aplicável.
      const ADMIN_ACTIONS_SEM_CONFIG = new Set(['validate-config', 'invalidate-config']);
      if (!dynamicConfig && !ADMIN_ACTIONS_SEM_CONFIG.has(action)) {
        return new Response(
          JSON.stringify({
            success: false,
            codigo_erro: 'CONFIG_INDISPONIVEL',
            error:    'Configuração da clínica indisponível',
            mensagem_usuario:
              `❌ A configuração desta clínica não foi encontrada. ` +
              `Verifique o cliente_id e se a clínica concluiu o setup. ` +
              `(Use /validate-config pra diagnosticar.)`,
            detalhes: { cliente_id: CLIENTE_ID, config_id: CONFIG_ID ?? null },
          }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // (Schema validation já rodou antes do loadDynamicConfig, ver F9.1 acima)

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
        case 'chat':
          return await withLogging('chat', CLIENTE_ID, requestId, body,
            () => handleChat(supabase, body, CLIENTE_ID, dynamicConfig));
        case 'validate-config':
        case 'validar-config':
          return await withLogging('validate-config', CLIENTE_ID, requestId, body,
            () => handleValidateConfig(supabase, body, CLIENTE_ID));
        case 'invalidate-config':
        case 'invalidar-config':
          return await withLogging('invalidate-config', CLIENTE_ID, requestId, body,
            () => handleInvalidateConfig(supabase, body, CLIENTE_ID, auth.mode));
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
        error_stack: sanitizeStack(error?.stack)
      }
    });
    return errorResponse(`Erro interno: ${error?.message || 'Erro desconhecido'}`);
  }
})
