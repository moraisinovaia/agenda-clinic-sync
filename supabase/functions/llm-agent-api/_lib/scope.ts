// ============= SISTEMA DE ESCOPO DE REQUISIÇÕES =============

import type { RequestScope } from './types.ts'

export function normalizeScopeEntries(value: any): string[] {
  if (!value) return [];

  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  return Array.from(new Set(
    rawValues
      .map((entry: any) => typeof entry === 'string' ? entry.trim() : '')
      .filter(Boolean)
  ));
}

export function normalizeScopeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/[_\s-]+/g, ' ')
    .trim();
}

export function getRequestScope(body: any): RequestScope {
  return {
    doctorIds: normalizeScopeEntries(
      body?.allowed_doctor_ids ??
      body?.doctor_scope_ids ??
      body?.doctor_scope ??
      body?.medico_ids_permitidos
    ),
    doctorNames: normalizeScopeEntries(
      body?.allowed_doctor_names ??
      body?.doctor_scope_names ??
      body?.medico_nomes_permitidos
    ),
    serviceNames: normalizeScopeEntries(
      body?.allowed_services ??
      body?.service_scope ??
      body?.servicos_permitidos
    ),
  };
}

export function hasDoctorScope(scope: RequestScope): boolean {
  return scope.doctorIds.length > 0 || scope.doctorNames.length > 0;
}

export function hasServiceScope(scope: RequestScope): boolean {
  return scope.serviceNames.length > 0;
}

export function isDoctorAllowed(
  medicoId: string | null | undefined,
  medicoNome: string | null | undefined,
  scope: RequestScope
): boolean {
  if (!hasDoctorScope(scope)) return true;

  if (medicoId && scope.doctorIds.includes(medicoId)) {
    return true;
  }

  if (medicoNome && scope.doctorNames.length > 0) {
    const nomeNormalizado = normalizeScopeText(medicoNome);
    return scope.doctorNames.some((allowedName) => {
      const allowedNormalizado = normalizeScopeText(allowedName);
      return (
        nomeNormalizado === allowedNormalizado ||
        nomeNormalizado.includes(allowedNormalizado) ||
        allowedNormalizado.includes(nomeNormalizado)
      );
    });
  }

  return false;
}

export function isServiceAllowed(servicoNome: string | null | undefined, scope: RequestScope): boolean {
  if (!hasServiceScope(scope)) return true;
  if (!servicoNome) return true;

  const servicoNormalizado = normalizeScopeText(servicoNome);

  return scope.serviceNames.some((allowedService) => {
    const allowedNormalizado = normalizeScopeText(allowedService);
    return (
      servicoNormalizado === allowedNormalizado ||
      servicoNormalizado.includes(allowedNormalizado) ||
      allowedNormalizado.includes(servicoNormalizado)
    );
  });
}

export function filterDoctorsByScope<T extends { id?: string | null; nome?: string | null }>(medicos: T[], scope: RequestScope): T[] {
  if (!hasDoctorScope(scope)) return medicos;
  return medicos.filter((medico) => isDoctorAllowed(medico.id, medico.nome, scope));
}

export function isAppointmentAllowed(
  medicoId: string | null | undefined,
  medicoNome: string | null | undefined,
  atendimentoNome: string | null | undefined,
  scope: RequestScope
): boolean {
  return isDoctorAllowed(medicoId, medicoNome, scope) && isServiceAllowed(atendimentoNome, scope);
}

export function getScopeSummary(scope: RequestScope): string {
  const partes: string[] = [];

  if (hasDoctorScope(scope)) {
    partes.push(`médicos: ${getDoctorScopeSummary(scope)}`);
  }

  if (hasServiceScope(scope)) {
    partes.push(`serviços: ${scope.serviceNames.join(', ')}`);
  }

  return partes.length > 0 ? partes.join(' | ') : 'canal atual';
}

export function getDoctorScopeSummary(scope: RequestScope): string {
  if (scope.doctorNames.length > 0) {
    return scope.doctorNames.join(', ');
  }
  if (scope.doctorIds.length > 0) {
    return `${scope.doctorIds.length} médico(s) autorizado(s)`;
  }
  return 'escopo atual';
}
