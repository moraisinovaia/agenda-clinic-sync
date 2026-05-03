// ============= SISTEMA DE LOGGING ESTRUTURADO =============

import type { StructuredLog } from './types.ts'

/**
 * Normaliza erros de domínio e infraestrutura em códigos estáveis para filtragem.
 * Erros de domínio têm severidade menor que erros de infraestrutura.
 */
export function normalizeErrorCode(error: any): { code: string; level: 'warn' | 'error' } {
  const name = error?.name ?? '';
  if (name === 'SlotAlreadyTakenError')         return { code: 'SLOT_TAKEN',                level: 'warn' };
  if (name === 'DuplicateBookingError')          return { code: 'DUPLICATE_BOOKING',         level: 'warn' };
  if (name === 'AppointmentNotFoundError')       return { code: 'APPOINTMENT_NOT_FOUND',     level: 'warn' };
  if (name === 'InvalidStatusTransitionError')   return { code: 'INVALID_STATUS_TRANSITION', level: 'warn' };
  return { code: error?.code || 'INTERNAL_ERROR', level: 'error' };
}

// Métricas agregadas em memória (reset a cada cold start)
// IMPORTANTE: cada Edge Function instance tem suas próprias métricas — pra
// agregação de fato multi-instance, depender de Logflare/Grafana lendo os
// `structuredLog`. Estas métricas são úteis pra `/metrics` health check e
// monitoramento básico de operação.
export const METRICS = {
  start_time: Date.now(),
  total_requests: 0,
  success_count: 0,
  error_count: 0,
  total_duration_ms: 0,
  by_action:  new Map<string, { count: number; total_ms: number; errors: number }>(),
  // [Multi-tenant] saber quando UM cliente específico está com problema sem
  // precisar atravessar Logflare. Reset a cada cold start.
  by_cliente: new Map<string, { count: number; total_ms: number; errors: number }>(),
};

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function structuredLog(log: StructuredLog): void {
  console.log(JSON.stringify(log));
}

/**
 * Sanitiza stack trace pra log estruturado:
 *   - trunca a 500 chars (anti-blowup)
 *   - remove `file://` e paths absolutos do Deno (evita expor estrutura)
 *   - remove qualquer string que pareça PII conhecida (email, telefone formato BR)
 *
 * Use em vez de logar `error.stack` direto.
 */
export function sanitizeStack(stack: unknown): string | undefined {
  if (typeof stack !== 'string' || stack.length === 0) return undefined;
  let s = stack;
  // remove paths absolutos (file:///home/.../) e deno-internal
  s = s.replace(/file:\/\/[^\s)]+/g, '<path>');
  s = s.replace(/\/[A-Za-z0-9_\-./]+\.(ts|js)/g, '<path>');
  // remove emails
  s = s.replace(/[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '<email>');
  // remove telefones BR (DDD + 8-9 dígitos)
  s = s.replace(/\b\d{2}[-\s]?9?\d{4}[-\s]?\d{4}\b/g, '<phone>');
  return s.substring(0, 500);
}

export function updateMetrics(
  action: string,
  durationMs: number,
  success: boolean,
  clienteId?: string,
): void {
  METRICS.total_requests++;
  METRICS.total_duration_ms += durationMs;
  if (success) {
    METRICS.success_count++;
  } else {
    METRICS.error_count++;
  }

  const actionMetrics = METRICS.by_action.get(action) || { count: 0, total_ms: 0, errors: 0 };
  actionMetrics.count++;
  actionMetrics.total_ms += durationMs;
  if (!success) actionMetrics.errors++;
  METRICS.by_action.set(action, actionMetrics);

  // [Multi-tenant] dimensão por cliente
  if (clienteId) {
    const tenantMetrics = METRICS.by_cliente.get(clienteId) || { count: 0, total_ms: 0, errors: 0 };
    tenantMetrics.count++;
    tenantMetrics.total_ms += durationMs;
    if (!success) tenantMetrics.errors++;
    METRICS.by_cliente.set(clienteId, tenantMetrics);
  }
}

/**
 * Snapshot serializável de METRICS pra endpoint /metrics health.
 */
export function getMetricsSnapshot(): Record<string, unknown> {
  const uptime_ms   = Date.now() - METRICS.start_time;
  const error_rate  = METRICS.total_requests > 0
    ? METRICS.error_count / METRICS.total_requests
    : 0;
  const avg_duration_ms = METRICS.total_requests > 0
    ? Math.round(METRICS.total_duration_ms / METRICS.total_requests)
    : 0;

  const by_action = Array.from(METRICS.by_action.entries())
    .map(([action, m]) => ({
      action,
      count:           m.count,
      errors:          m.errors,
      avg_duration_ms: Math.round(m.total_ms / m.count),
      error_rate:      m.count > 0 ? m.errors / m.count : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const by_cliente = Array.from(METRICS.by_cliente.entries())
    .map(([cliente_id, m]) => ({
      cliente_id,
      count:           m.count,
      errors:          m.errors,
      avg_duration_ms: Math.round(m.total_ms / m.count),
      error_rate:      m.count > 0 ? m.errors / m.count : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    healthy:          error_rate < 0.1,  // <10% de erro = saudável
    uptime_ms,
    uptime_human:     formatUptime(uptime_ms),
    total_requests:   METRICS.total_requests,
    success_count:    METRICS.success_count,
    error_count:      METRICS.error_count,
    error_rate,
    avg_duration_ms,
    by_action,
    by_cliente,
  };
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export async function withLogging<T>(
  handlerName: string,
  clienteId: string,
  requestId: string,
  body: any,
  handler: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  const medicoId: string | undefined = body?.medico_id || undefined;
  const configId: string | undefined = body?.config_id || undefined;

  // Log de entrada
  structuredLog({
    timestamp: new Date().toISOString(),
    request_id: requestId,
    cliente_id: clienteId,
    config_id: configId,
    medico_id: medicoId,
    action: handlerName,
    level: 'info',
    phase: 'request',
    metadata: {
      body_keys: Object.keys(body || {}),
      body_size: JSON.stringify(body || {}).length
    }
  });

  try {
    const result = await handler();
    const duration = Math.round(performance.now() - startTime);

    updateMetrics(handlerName, duration, true, clienteId);

    structuredLog({
      timestamp: new Date().toISOString(),
      request_id: requestId,
      cliente_id: clienteId,
      config_id: configId,
      medico_id: medicoId,
      action: handlerName,
      level: 'info',
      phase: 'response',
      duration_ms: duration,
      success: true,
    });

    return result;
  } catch (error: any) {
    const duration = Math.round(performance.now() - startTime);
    const { code, level } = normalizeErrorCode(error);

    updateMetrics(handlerName, duration, false, clienteId);

    structuredLog({
      timestamp: new Date().toISOString(),
      request_id: requestId,
      cliente_id: clienteId,
      config_id: configId,
      medico_id: medicoId,
      action: handlerName,
      level,
      phase: 'response',
      duration_ms: duration,
      success: false,
      error_code: code,
      metadata: {
        error_name: error?.name,
        error_message: error?.message,
        error_stack: level === 'error' ? sanitizeStack(error?.stack) : undefined,
      },
    });

    throw error;
  }
}
