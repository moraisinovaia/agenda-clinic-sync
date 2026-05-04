// Testes do validador de business_rules.config (Sprint 1.2 multi-tenant)
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { validateBusinessRulesConfig } from '../_lib/validate-config.ts';

const baseConsultaServico = {
  tipo: 'ordem_chegada',
  // dias_semana cobre união dos dias_especificos por período (manha[1,2,4] + tarde[3])
  dias_semana: [1, 2, 3, 4],
  compartilha_limite_com: 'Retorno Cardiológico',
  periodos: {
    manha: {
      inicio: '07:00',
      fim: '10:00',
      contagem_inicio: '07:00',
      contagem_fim: '12:00',
      limite: 14,
      dias_especificos: [1, 2, 4],
    },
    tarde: {
      inicio: '13:00',
      fim: '15:00',
      contagem_inicio: '12:00',
      contagem_fim: '18:00',
      limite: 14,
      dias_especificos: [3],
    },
  },
};

Deno.test('validate-config: config completa válida → ok=true, 0 errors', () => {
  const config = {
    servicos: {
      'Consulta Cardiológica': baseConsultaServico,
      'Retorno Cardiológico': baseConsultaServico,
    },
  };
  const r = validateBusinessRulesConfig(config);
  assertEquals(r.summary.errors, 0);
  assertEquals(r.ok, true);
});

Deno.test('validate-config: dias_semana NÃO cobre dias_especificos do período → error (bug do MRPA-sexta)', () => {
  // Reproduz exatamente o estado da config do Dr. Marcelo antes do nosso fix:
  // dias_semana=[2,3,4] mas manha.dias_especificos=[3,4,5] — 5 silenciosamente pulado
  const config = {
    servicos: {
      MRPA: {
        ...baseConsultaServico,
        dias_semana: [2, 3, 4],
        periodos: {
          manha: { ...baseConsultaServico.periodos.manha, dias_especificos: [3, 4, 5] },
          tarde: { ...baseConsultaServico.periodos.tarde, dias_especificos: [2, 3, 4] },
        },
      },
    },
  };
  const r = validateBusinessRulesConfig(config);
  assertEquals(r.ok, false);
  const finding = r.findings.find(
    (f) => f.rule === 'dias_semana_must_cover_dias_especificos',
  );
  assert(finding, 'esperado finding dias_semana_must_cover_dias_especificos');
  assertEquals(finding!.severity, 'error');
  assertEquals(finding!.details!.ausentes_no_top_level, [5]);
});

Deno.test('validate-config: tipo inválido → error', () => {
  const config = {
    servicos: {
      X: { ...baseConsultaServico, tipo: 'algo_estranho' },
    },
  };
  const r = validateBusinessRulesConfig(config);
  assert(r.findings.some((f) => f.rule === 'tipo_enum'));
});

Deno.test('validate-config: limite negativo → error', () => {
  const config = {
    servicos: {
      X: {
        ...baseConsultaServico,
        periodos: {
          manha: { ...baseConsultaServico.periodos.manha, limite: -1 },
        },
      },
    },
  };
  const r = validateBusinessRulesConfig(config);
  assert(r.findings.some((f) => f.rule === 'limite_positive_int'));
});

Deno.test('validate-config: hora fora do formato → error', () => {
  const config = {
    servicos: {
      X: {
        ...baseConsultaServico,
        periodos: {
          manha: { ...baseConsultaServico.periodos.manha, inicio: '7am' },
        },
      },
    },
  };
  const r = validateBusinessRulesConfig(config);
  assert(r.findings.some((f) => f.rule === 'hora_format'));
});

Deno.test('validate-config: inicio >= fim → error', () => {
  const config = {
    servicos: {
      X: {
        ...baseConsultaServico,
        periodos: {
          manha: { ...baseConsultaServico.periodos.manha, inicio: '12:00', fim: '07:00' },
        },
      },
    },
  };
  const r = validateBusinessRulesConfig(config);
  assert(r.findings.some((f) => f.rule === 'inicio_lt_fim'));
});

Deno.test('validate-config: dias_especificos com valores fora de 0-6 → error', () => {
  const config = {
    servicos: {
      X: {
        ...baseConsultaServico,
        periodos: {
          manha: { ...baseConsultaServico.periodos.manha, dias_especificos: [1, 2, 9] },
        },
      },
    },
  };
  const r = validateBusinessRulesConfig(config);
  assert(r.findings.some((f) => f.rule === 'dias_especificos_valid_range'));
});

Deno.test('validate-config: compartilha_limite_com aponta para serviço inexistente → warn', () => {
  const config = {
    servicos: {
      'Consulta Cardiológica': {
        ...baseConsultaServico,
        compartilha_limite_com: 'Servico Que Nao Existe',
      },
    },
  };
  const r = validateBusinessRulesConfig(config);
  const finding = r.findings.find((f) => f.rule === 'compartilha_limite_com_target_exists');
  assert(finding);
  assertEquals(finding!.severity, 'warn');
  // warn não bloqueia ok
  assertEquals(r.ok, true);
});

Deno.test('validate-config: walk_in_info_only sem periodos → ok (config legítima)', () => {
  const config = {
    servicos: {
      ECG: {
        tipo: 'walk_in_info_only',
        // sem periodos
      },
    },
  };
  const r = validateBusinessRulesConfig(config);
  assertEquals(r.ok, true);
});

Deno.test('validate-config: serviço oculto:true sem periodos → ok (rota interna)', () => {
  const config = {
    servicos: {
      'Agenda Particular Sexta Tarde': {
        oculto: true,
      },
    },
  };
  const r = validateBusinessRulesConfig(config);
  assertEquals(r.ok, true);
});

Deno.test('validate-config: medicos_relacionados com não-string → error', () => {
  const config = {
    medicos_relacionados: ['uuid-1', 123, ''],
    servicos: { X: baseConsultaServico },
  };
  const r = validateBusinessRulesConfig(config);
  assert(r.findings.some((f) => f.rule === 'medicos_relacionados_uuids'));
});

Deno.test('validate-config: contagem_fim < fim → warn', () => {
  const config = {
    servicos: {
      X: {
        ...baseConsultaServico,
        periodos: {
          manha: {
            ...baseConsultaServico.periodos.manha,
            fim: '10:00',
            contagem_fim: '09:00',
          },
        },
      },
    },
  };
  const r = validateBusinessRulesConfig(config);
  const finding = r.findings.find((f) => f.rule === 'contagem_fim_ge_fim');
  assert(finding);
  assertEquals(finding!.severity, 'warn');
});

Deno.test('validate-config: config null → error', () => {
  const r = validateBusinessRulesConfig(null);
  assertEquals(r.ok, false);
  assert(r.findings.some((f) => f.rule === 'config_must_be_object'));
});

Deno.test('validate-config: config sem servicos → error', () => {
  const r = validateBusinessRulesConfig({ medicos_relacionados: [] });
  assertEquals(r.ok, false);
  assert(r.findings.some((f) => f.rule === 'servicos_required'));
});
