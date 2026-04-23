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
export const METRICS = {
  start_time: Date.now(),
  total_requests: 0,
  success_count: 0,
  error_count: 0,
  total_duration_ms: 0,
  by_action: new Map<string, { count: number; total_ms: number; errors: number }>()
};

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function structuredLog(log: StructuredLog): void {
  console.log(JSON.stringify(log));
}

export function updateMetrics(action: string, durationMs: number, success: boolean): void {
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

    updateMetrics(handlerName, duration, true);

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

    updateMetrics(handlerName, duration, false);

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
        error_stack: level === 'error' ? error?.stack?.substring(0, 500) : undefined,
      },
    });

    throw error;
  }
}
