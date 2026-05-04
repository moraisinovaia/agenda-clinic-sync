// ============= VALIDADOR DE CONSISTÊNCIA DE business_rules.config =============
//
// Roda checks estáticos no JSONB de configuração de uma clínica/médico antes
// que cause comportamento errado em produção. Foi escrito após descobrir, na
// hora de adicionar sexta ao MRPA do Dr. Marcelo, que o `dias_semana` top-level
// NÃO incluía 5 mas os `dias_especificos` por período sim — o UseCase filtra
// pelo top-level antes do per-period, e Friday era pulado silenciosamente.
//
// Tipos de problema detectados:
//   - error: bug certo que vai gerar comportamento errado em prod
//   - warn:  inconsistência que provavelmente é bug mas pode ser intencional
//   - info:  observação útil para onboarding
//
// Cada finding aponta o caminho dot-notation no JSON (ex.: `servicos.MRPA.periodos.manha`)
// pra que admin/ferramenta consiga apontar exatamente onde corrigir.
//
// Função pura — sem I/O. O caller (admin endpoint, smoke teste, CI) decide
// como apresentar/usar o relatório.

export type ValidationSeverity = 'error' | 'warn' | 'info';

export interface ValidationFinding {
  severity: ValidationSeverity;
  path:     string;          // ex.: "servicos.MRPA.periodos.manha.dias_especificos"
  rule:     string;          // ex.: "dias_semana_subset_of_dias_especificos"
  message:  string;
  details?: Record<string, unknown>;
}

export interface ValidationReport {
  ok:        boolean;        // true se 0 errors (warns não bloqueiam)
  summary:   {
    errors: number;
    warns:  number;
    infos:  number;
  };
  findings:  ValidationFinding[];
}

const PERIOD_KEYS = ['manha', 'tarde'] as const;
const VALID_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const VALID_TIPOS = ['ordem_chegada', 'fixed_time', 'walk_in_info_only', 'hora_marcada'];
const VALID_TIPO_AGENDAMENTO = ['ordem_chegada', 'hora_marcada', 'estimativa_horario'];

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidHora(h: unknown): boolean {
  return typeof h === 'string' && HORA_REGEX.test(h);
}

function compareHora(a: string, b: string): number {
  // ambos no formato HH:MM
  return a.localeCompare(b);
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * Valida o JSONB completo de business_rules.config.
 * Roda todas as regras estáticas. Retorna relatório.
 */
export function validateBusinessRulesConfig(config: any): ValidationReport {
  const findings: ValidationFinding[] = [];

  if (!config || typeof config !== 'object') {
    findings.push({
      severity: 'error',
      path:     '$',
      rule:     'config_must_be_object',
      message:  'config deve ser um objeto JSON.',
    });
    return buildReport(findings);
  }

  // — Top-level — //
  validateTopLevel(config, findings);

  // — Cada serviço — //
  const servicos = config?.servicos;
  if (!servicos || typeof servicos !== 'object') {
    findings.push({
      severity: 'error',
      path:     'servicos',
      rule:     'servicos_required',
      message:  'config.servicos é obrigatório.',
    });
    return buildReport(findings);
  }

  for (const [servicoKey, servico] of Object.entries(servicos)) {
    validateServico(servicoKey, servico, findings);
  }

  // — Coerência cross-serviço — //
  validateCrossServico(servicos, findings);

  return buildReport(findings);
}

function validateTopLevel(config: any, findings: ValidationFinding[]): void {
  // medicos_relacionados deve ser array de UUIDs (ou ausente)
  if (config.medicos_relacionados !== undefined) {
    if (!Array.isArray(config.medicos_relacionados)) {
      findings.push({
        severity: 'error',
        path:     'medicos_relacionados',
        rule:     'medicos_relacionados_array',
        message:  '`medicos_relacionados` deve ser array de UUIDs (ou ausente).',
      });
    } else {
      const invalidos = config.medicos_relacionados.filter(
        (id: unknown) => typeof id !== 'string' || id.length === 0,
      );
      if (invalidos.length > 0) {
        findings.push({
          severity: 'error',
          path:     'medicos_relacionados',
          rule:     'medicos_relacionados_uuids',
          message:  '`medicos_relacionados` contém valores inválidos.',
          details:  { invalidos },
        });
      }
    }
  }
}

function validateServico(
  servicoKey: string,
  servico: any,
  findings: ValidationFinding[],
): void {
  const path = `servicos.${servicoKey}`;

  if (!servico || typeof servico !== 'object') {
    findings.push({
      severity: 'error',
      path,
      rule:     'servico_must_be_object',
      message:  `servicos.${servicoKey} deve ser um objeto.`,
    });
    return;
  }

  // tipo
  if (servico.tipo !== undefined && !VALID_TIPOS.includes(servico.tipo)) {
    findings.push({
      severity: 'error',
      path:     `${path}.tipo`,
      rule:     'tipo_enum',
      message:  `tipo "${servico.tipo}" não é válido.`,
      details:  { aceitos: VALID_TIPOS },
    });
  }

  // tipo_agendamento (campo paralelo usado em algumas configs)
  if (servico.tipo_agendamento !== undefined && !VALID_TIPO_AGENDAMENTO.includes(servico.tipo_agendamento)) {
    findings.push({
      severity: 'error',
      path:     `${path}.tipo_agendamento`,
      rule:     'tipo_agendamento_enum',
      message:  `tipo_agendamento "${servico.tipo_agendamento}" não é válido.`,
      details:  { aceitos: VALID_TIPO_AGENDAMENTO },
    });
  }

  // serviços `oculto: true`, walk_in_info_only ou fixed_time podem ter regras de
  // período diferentes (fixed_time usa keys por dia da semana — ex.: 'segunda',
  // 'terca'). Skipamos a validação manha/tarde pra não gerar falsos positivos.
  const isOculto    = servico.oculto === true;
  const isWalkIn    = servico.tipo === 'walk_in_info_only';
  const isFixedTime = servico.tipo === 'fixed_time';

  // dias_semana top-level
  if (servico.dias_semana !== undefined) {
    if (!Array.isArray(servico.dias_semana)) {
      findings.push({
        severity: 'error',
        path:     `${path}.dias_semana`,
        rule:     'dias_semana_array',
        message:  '`dias_semana` deve ser array de inteiros 0-6.',
      });
    } else {
      const invalidos = servico.dias_semana.filter(
        (d: unknown) => typeof d !== 'number' || !VALID_WEEKDAYS.includes(d),
      );
      if (invalidos.length > 0) {
        findings.push({
          severity: 'error',
          path:     `${path}.dias_semana`,
          rule:     'dias_semana_valid_range',
          message:  '`dias_semana` contém valores fora de 0-6.',
          details:  { invalidos },
        });
      }
    }
  }

  // periodos
  const periodos = servico.periodos;
  if (!periodos || typeof periodos !== 'object') {
    if (!isWalkIn && !isOculto) {
      findings.push({
        severity: 'error',
        path:     `${path}.periodos`,
        rule:     'periodos_required',
        message:  `servicos.${servicoKey}.periodos é obrigatório (exceto walk_in_info_only/oculto).`,
      });
    }
    return;
  }

  // fixed_time usa keys por dia da semana (segunda, terca, ...) — validamos
  // só a presença de `hora` e `dias_especificos` em cada um, sem aplicar regra
  // manha/tarde.
  if (isFixedTime) {
    validateFixedTimePeriodos(servicoKey, periodos, findings);
    return;
  }

  const diasEspecificosUnion: number[] = [];
  for (const pk of PERIOD_KEYS) {
    const p = periodos[pk];
    if (p === undefined) continue;
    validatePeriodo(servicoKey, pk, p, servico, findings);
    if (Array.isArray(p?.dias_especificos)) {
      diasEspecificosUnion.push(...p.dias_especificos.filter((d: unknown) =>
        typeof d === 'number' && VALID_WEEKDAYS.includes(d),
      ));
    }
  }

  // [Regra crítica] dias_semana ⊇ união dos dias_especificos
  // Sem isso, o UseCase filtra pelo top-level e dia configurado em algum
  // período é silenciosamente pulado. Foi exatamente o bug do MRPA-sexta.
  if (Array.isArray(servico.dias_semana) && diasEspecificosUnion.length > 0) {
    const diasSemanaSet = new Set(servico.dias_semana);
    const fora = unique(diasEspecificosUnion).filter((d) => !diasSemanaSet.has(d));
    if (fora.length > 0) {
      findings.push({
        severity: 'error',
        path:     `${path}.dias_semana`,
        rule:     'dias_semana_must_cover_dias_especificos',
        message:  `dias_semana=[${[...diasSemanaSet].sort().join(',')}] não cobre dias_especificos dos períodos: faltam [${fora.sort().join(',')}]. Estes dias serão silenciosamente pulados.`,
        details:  {
          dias_semana:                 [...diasSemanaSet].sort(),
          dias_especificos_no_periodo: unique(diasEspecificosUnion).sort(),
          ausentes_no_top_level:       fora.sort(),
        },
      });
    }
  }

  // pool sharing
  if (servico.compartilha_limite_com) {
    if (typeof servico.compartilha_limite_com !== 'string' || servico.compartilha_limite_com.length === 0) {
      findings.push({
        severity: 'error',
        path:     `${path}.compartilha_limite_com`,
        rule:     'compartilha_limite_com_string',
        message:  '`compartilha_limite_com` deve ser nome do serviço (string não vazia).',
      });
    }
  }
}

function validatePeriodo(
  servicoKey: string,
  pk: string,
  periodo: any,
  servico: any,
  findings: ValidationFinding[],
): void {
  const path = `servicos.${servicoKey}.periodos.${pk}`;

  if (!periodo || typeof periodo !== 'object') {
    findings.push({
      severity: 'error',
      path,
      rule:     'periodo_must_be_object',
      message:  `${path} deve ser um objeto.`,
    });
    return;
  }

  const isFixedTime = servico.tipo === 'fixed_time';

  // limite
  const limite = periodo.limite;
  if (typeof limite !== 'number' || !Number.isFinite(limite) || limite <= 0) {
    findings.push({
      severity: 'error',
      path:     `${path}.limite`,
      rule:     'limite_positive_int',
      message:  `${path}.limite deve ser inteiro > 0.`,
      details:  { atual: limite },
    });
  }

  // inicio / fim (display)
  const inicio = periodo.inicio;
  const fim    = periodo.fim;
  if (inicio !== undefined && !isValidHora(inicio)) {
    findings.push({
      severity: 'error',
      path:     `${path}.inicio`,
      rule:     'hora_format',
      message:  `${path}.inicio fora do formato HH:MM.`,
      details:  { atual: inicio },
    });
  }
  if (fim !== undefined && !isValidHora(fim)) {
    findings.push({
      severity: 'error',
      path:     `${path}.fim`,
      rule:     'hora_format',
      message:  `${path}.fim fora do formato HH:MM.`,
      details:  { atual: fim },
    });
  }
  if (isValidHora(inicio) && isValidHora(fim) && compareHora(inicio, fim) >= 0) {
    findings.push({
      severity: 'error',
      path,
      rule:     'inicio_lt_fim',
      message:  `${path}.inicio (${inicio}) deve ser estritamente menor que .fim (${fim}).`,
    });
  }

  // contagem_inicio / contagem_fim (janela formal de capacidade)
  const cInicio = periodo.contagem_inicio;
  const cFim    = periodo.contagem_fim;
  if (cInicio !== undefined && !isValidHora(cInicio)) {
    findings.push({
      severity: 'error',
      path:     `${path}.contagem_inicio`,
      rule:     'hora_format',
      message:  `${path}.contagem_inicio fora do formato HH:MM.`,
    });
  }
  if (cFim !== undefined && !isValidHora(cFim)) {
    findings.push({
      severity: 'error',
      path:     `${path}.contagem_fim`,
      rule:     'hora_format',
      message:  `${path}.contagem_fim fora do formato HH:MM.`,
    });
  }
  if (isValidHora(cInicio) && isValidHora(cFim) && compareHora(cInicio, cFim) >= 0) {
    findings.push({
      severity: 'error',
      path,
      rule:     'contagem_inicio_lt_contagem_fim',
      message:  `${path}.contagem_inicio (${cInicio}) deve ser < .contagem_fim (${cFim}).`,
    });
  }
  // contagem deve englobar inicio/fim
  if (isValidHora(cInicio) && isValidHora(inicio) && compareHora(cInicio, inicio) > 0) {
    findings.push({
      severity: 'warn',
      path,
      rule:     'contagem_inicio_le_inicio',
      message:  `${path}.contagem_inicio (${cInicio}) > .inicio (${inicio}). A janela de contagem deveria começar antes ou junto com a janela de exibição.`,
    });
  }
  if (isValidHora(cFim) && isValidHora(fim) && compareHora(cFim, fim) < 0) {
    findings.push({
      severity: 'warn',
      path,
      rule:     'contagem_fim_ge_fim',
      message:  `${path}.contagem_fim (${cFim}) < .fim (${fim}). Pacientes lançados depois do .fim e antes do .contagem_fim correm o risco de não serem contados.`,
    });
  }

  // dias_especificos
  if (periodo.dias_especificos !== undefined) {
    if (!Array.isArray(periodo.dias_especificos)) {
      findings.push({
        severity: 'error',
        path:     `${path}.dias_especificos`,
        rule:     'dias_especificos_array',
        message:  '`dias_especificos` deve ser array de 0-6.',
      });
    } else {
      const invalidos = periodo.dias_especificos.filter(
        (d: unknown) => typeof d !== 'number' || !VALID_WEEKDAYS.includes(d),
      );
      if (invalidos.length > 0) {
        findings.push({
          severity: 'error',
          path:     `${path}.dias_especificos`,
          rule:     'dias_especificos_valid_range',
          message:  '`dias_especificos` contém valores fora de 0-6.',
          details:  { invalidos },
        });
      }
      if (periodo.dias_especificos.length === 0) {
        findings.push({
          severity: 'warn',
          path:     `${path}.dias_especificos`,
          rule:     'dias_especificos_empty',
          message:  `${path}.dias_especificos vazio — nenhum dia atende este período.`,
        });
      }
    }
  }

  // fixed_time exige hora
  if (isFixedTime) {
    // pra fixed_time, esperamos `dias_especificos` ou `dias` por dia da semana com hora marcada.
    // O formato pode variar — só apontamos se NEM hora NEM `dias_especificos` estão presentes.
    if (!isValidHora(periodo.hora) && !Array.isArray(periodo.dias_especificos)) {
      findings.push({
        severity: 'warn',
        path,
        rule:     'fixed_time_needs_hora',
        message:  `${path}: serviço fixed_time deve definir "hora" ou "dias_especificos" por dia.`,
      });
    }
  }

  // distribuicao_fichas (string descritiva opcional)
  if (periodo.distribuicao_fichas !== undefined && typeof periodo.distribuicao_fichas !== 'string') {
    findings.push({
      severity: 'warn',
      path:     `${path}.distribuicao_fichas`,
      rule:     'distribuicao_fichas_string',
      message:  '`distribuicao_fichas` deveria ser string descritiva.',
    });
  }
}

function validateFixedTimePeriodos(
  servicoKey: string,
  periodos: Record<string, any>,
  findings: ValidationFinding[],
): void {
  const path = `servicos.${servicoKey}.periodos`;
  // Aceita keys arbitrárias (segunda/terca/etc OU manha/tarde com hora marcada).
  // Cada entry deve ter ao menos `hora` (HH:MM) e `limite` > 0.
  for (const [key, p] of Object.entries(periodos)) {
    const subPath = `${path}.${key}`;
    if (!p || typeof p !== 'object') {
      findings.push({
        severity: 'error',
        path:     subPath,
        rule:     'fixed_time_periodo_object',
        message:  `${subPath} deve ser um objeto.`,
      });
      continue;
    }
    if (!isValidHora((p as any).hora)) {
      findings.push({
        severity: 'error',
        path:     `${subPath}.hora`,
        rule:     'fixed_time_hora_required',
        message:  `${subPath}.hora é obrigatório (HH:MM).`,
        details:  { atual: (p as any).hora },
      });
    }
    const limite = (p as any).limite;
    if (typeof limite !== 'number' || !Number.isFinite(limite) || limite <= 0) {
      findings.push({
        severity: 'error',
        path:     `${subPath}.limite`,
        rule:     'limite_positive_int',
        message:  `${subPath}.limite deve ser inteiro > 0.`,
        details:  { atual: limite },
      });
    }
  }
}

function validateCrossServico(
  servicos: Record<string, any>,
  findings: ValidationFinding[],
): void {
  // compartilha_limite_com aponta pra serviço que existe
  const nomes = Object.keys(servicos);
  for (const [k, s] of Object.entries(servicos)) {
    const target = (s as any)?.compartilha_limite_com;
    if (typeof target === 'string' && target.length > 0 && !nomes.includes(target)) {
      findings.push({
        severity: 'warn',
        path:     `servicos.${k}.compartilha_limite_com`,
        rule:     'compartilha_limite_com_target_exists',
        message:  `compartilha_limite_com aponta para "${target}", mas esse serviço não está na config.`,
        details:  { servicos_disponiveis: nomes },
      });
    }
  }
}

function buildReport(findings: ValidationFinding[]): ValidationReport {
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warns  = findings.filter((f) => f.severity === 'warn').length;
  const infos  = findings.filter((f) => f.severity === 'info').length;
  return {
    ok: errors === 0,
    summary: { errors, warns, infos },
    findings,
  };
}
