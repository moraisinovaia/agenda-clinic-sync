// ============= SISTEMA DE ESCOPO DE REQUISIÇÕES =============

import type { RequestScope } from './types.ts'

/**
 * Quando LLM_SCOPE_STRICT=true, requisições sem escopo de médico (doctorIds vazio
 * e doctorNames vazio) passam a ser bloqueadas em vez de abertas para todos os
 * médicos do tenant. Default permanece fail-open para não quebrar callers atuais.
 */
export function isScopeStrict(): boolean {
  try {
    return Deno.env.get('LLM_SCOPE_STRICT') === 'true';
  } catch {
    return false;
  }
}

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

export function getRequestScope(body: any, config?: any | null): RequestScope {
  const baseScope: RequestScope = {
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

  // [F1.1] Expandir scope com médicos relacionados (agendas dedicadas/virtuais)
  // declarados em business_rules.config.medicos_relacionados do médico principal.
  // Why: serviços como MAPA 24H e Teste Ergométrico vivem em medico_ids virtuais
  // (ex.: "MAPA - Dr. Marcelo"). Sem expansão, o n8n teria que conhecer cada virtual.
  // Multi-tenant safe: cada cliente declara seus virtuais na própria config.
  if (config?.business_rules && baseScope.doctorIds.length > 0) {
    const expandedIds = new Set<string>(baseScope.doctorIds);
    for (const principalId of baseScope.doctorIds) {
      const rule = config.business_rules[principalId];
      // A RPC `load_llm_config_for_clinic` aninha o JSON do médico em `rule.config`,
      // então `medicos_relacionados` vive em `rule.config.medicos_relacionados`.
      // Mantemos fallback para `rule.medicos_relacionados` como defesa caso a
      // estrutura mude no futuro ou em outros tenants.
      const relacionados = rule?.config?.medicos_relacionados ?? rule?.medicos_relacionados;
      if (Array.isArray(relacionados)) {
        for (const id of relacionados) {
          if (typeof id === 'string' && id.length > 0) expandedIds.add(id);
        }
      }
    }
    if (expandedIds.size > baseScope.doctorIds.length) {
      console.log(`🔗 [SCOPE] Expandido com médicos relacionados: ${baseScope.doctorIds.length} → ${expandedIds.size}`);
      baseScope.doctorIds = Array.from(expandedIds);
    }
  }

  return baseScope;
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
  if (!hasDoctorScope(scope)) {
    // Fail-open por default; fail-closed quando LLM_SCOPE_STRICT=true.
    return !isScopeStrict();
  }

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
  if (!hasDoctorScope(scope)) {
    // Mesma regra de isDoctorAllowed: sem escopo + flag estrita = não vaza nada.
    return isScopeStrict() ? [] : medicos;
  }
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
