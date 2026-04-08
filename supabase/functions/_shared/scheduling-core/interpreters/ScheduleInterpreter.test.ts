import { assertEquals, assertExists } from '@std/assert';
import { ScheduleInterpreter } from './ScheduleInterpreter.ts';

const interpreter = new ScheduleInterpreter();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rawPeriodo(overrides = {}) {
  return { inicio: '07:00', fim: '12:00', limite: 9, ...overrides };
}

function rawConfigSimples(tipo = 'ordem_chegada') {
  return {
    tipo_agendamento: tipo,
    periodos: { manha: rawPeriodo() },
  };
}

// ─── BookingMode ──────────────────────────────────────────────────────────────

Deno.test('ScheduleInterpreter — ordem_chegada → capacity_window', () => {
  const result = interpreter.interpret({ rawConfig: rawConfigSimples('ordem_chegada') });
  assertExists(result);
  assertEquals(result!.bookingMode, 'capacity_window');
});

Deno.test('ScheduleInterpreter — hora_marcada → time_slot', () => {
  const result = interpreter.interpret({ rawConfig: rawConfigSimples('hora_marcada') });
  assertExists(result);
  assertEquals(result!.bookingMode, 'time_slot');
});

Deno.test('ScheduleInterpreter — tipo ausente → fallback capacity_window', () => {
  const result = interpreter.interpret({
    rawConfig: { periodos: { manha: rawPeriodo() } },
  });
  assertExists(result);
  assertEquals(result!.bookingMode, 'capacity_window');
});

// ─── Períodos ─────────────────────────────────────────────────────────────────

Deno.test('ScheduleInterpreter — normaliza nomenclatura inicio/fim', () => {
  const result = interpreter.interpret({
    rawConfig: { periodos: { manha: { inicio: '07:00', fim: '12:00', limite: 5 } } },
  });
  assertExists(result);
  assertEquals(result!.periodos.manha?.inicio, '07:00');
  assertEquals(result!.periodos.manha?.fim, '12:00');
  assertEquals(result!.periodos.manha?.limite, 5);
});

Deno.test('ScheduleInterpreter — normaliza nomenclatura horario_inicio/horario_fim', () => {
  const result = interpreter.interpret({
    rawConfig: {
      periodos: { manha: { horario_inicio: '08:00', horario_fim: '13:00', limite: 7 } },
    },
  });
  assertExists(result);
  assertEquals(result!.periodos.manha?.inicio, '08:00');
  assertEquals(result!.periodos.manha?.fim, '13:00');
});

Deno.test('ScheduleInterpreter — descarta período com limite 0', () => {
  const result = interpreter.interpret({
    rawConfig: {
      periodos: {
        manha: rawPeriodo({ limite: 0 }),
        tarde: rawPeriodo({ inicio: '13:00', fim: '17:00', limite: 5 }),
      },
    },
  });
  assertExists(result);
  assertEquals(result!.periodos.manha, undefined);
  assertExists(result!.periodos.tarde);
});

Deno.test('ScheduleInterpreter — descarta período sem inicio ou fim', () => {
  const result = interpreter.interpret({
    rawConfig: {
      periodos: {
        manha: { limite: 5 }, // sem inicio/fim
        tarde: rawPeriodo({ inicio: '13:00', fim: '17:00', limite: 3 }),
      },
    },
  });
  assertExists(result);
  assertEquals(result!.periodos.manha, undefined);
  assertExists(result!.periodos.tarde);
});

Deno.test('ScheduleInterpreter — retorna null quando todos os períodos são inválidos', () => {
  const result = interpreter.interpret({
    rawConfig: { periodos: { manha: { limite: 0 } } },
  });
  assertEquals(result, null);
});

Deno.test('ScheduleInterpreter — ignora chaves de período desconhecidas', () => {
  const result = interpreter.interpret({
    rawConfig: {
      periodos: {
        manha: rawPeriodo(),
        noite: rawPeriodo({ inicio: '19:00', fim: '22:00', limite: 4 }), // chave inválida
      },
    },
  });
  assertExists(result);
  assertExists(result!.periodos.manha);
  assertEquals((result!.periodos as Record<string, unknown>).noite, undefined);
});

Deno.test('ScheduleInterpreter — preserva dias_especificos no período', () => {
  const result = interpreter.interpret({
    rawConfig: {
      periodos: { manha: { ...rawPeriodo(), dias_especificos: [1, 3, 5] } },
    },
  });
  assertExists(result);
  assertEquals(result!.periodos.manha?.dias_especificos, [1, 3, 5]);
});

// ─── Serviços ─────────────────────────────────────────────────────────────────

Deno.test('ScheduleInterpreter — resolve serviço por servicoKey', () => {
  const result = interpreter.interpret({
    rawConfig: {
      servicos: {
        consulta: {
          tipo: 'hora_marcada',
          periodos: { manha: rawPeriodo() },
        },
        retorno: {
          tipo: 'ordem_chegada',
          periodos: { tarde: rawPeriodo({ inicio: '13:00', fim: '17:00', limite: 5 }) },
        },
      },
    },
    servicoKey: 'retorno',
  });
  assertExists(result);
  assertEquals(result!.bookingMode, 'capacity_window');
  assertExists(result!.periodos.tarde);
  assertEquals(result!.periodos.manha, undefined);
});

Deno.test('ScheduleInterpreter — fallback para primeiro serviço com períodos se servicoKey ausente', () => {
  const result = interpreter.interpret({
    rawConfig: {
      servicos: {
        sem_periodo: { tipo: 'hora_marcada' }, // sem periodos → ignorado no fallback
        consulta: {
          tipo: 'hora_marcada',
          periodos: { manha: rawPeriodo() },
        },
      },
    },
  });
  assertExists(result);
  assertEquals(result!.bookingMode, 'time_slot');
});

Deno.test('ScheduleInterpreter — servicoKey inválida cai no fallback do primeiro serviço com períodos', () => {
  // resolveServico: servicoKey não encontrada → fallback para primeiro serviço com periodos
  // O primeiro serviço com períodos é 'consulta' (hora_marcada), não a raiz
  const result = interpreter.interpret({
    rawConfig: {
      tipo_agendamento: 'ordem_chegada',
      periodos: { tarde: rawPeriodo({ inicio: '13:00', fim: '17:00', limite: 6 }) },
      servicos: {
        consulta: { tipo: 'hora_marcada', periodos: { manha: rawPeriodo() } },
      },
    },
    servicoKey: 'nao_existe',
  });
  // servicoKey não encontrada → fallback = primeiro serviço com periodos (consulta → hora_marcada)
  assertExists(result);
  assertEquals(result!.bookingMode, 'time_slot');
  assertExists(result!.periodos.manha);
});

Deno.test('ScheduleInterpreter — sem servicos e sem servicoKey usa periodos da raiz', () => {
  // Quando não há servicos no config, usa periodos e tipo da raiz diretamente
  const result = interpreter.interpret({
    rawConfig: {
      tipo_agendamento: 'ordem_chegada',
      periodos: { tarde: rawPeriodo({ inicio: '13:00', fim: '17:00', limite: 6 }) },
    },
  });
  assertExists(result);
  assertEquals(result!.bookingMode, 'capacity_window');
  assertExists(result!.periodos.tarde);
});

// ─── Dias da semana e ordem_chegada_config ────────────────────────────────────

Deno.test('ScheduleInterpreter — propaga diasSemana da raiz', () => {
  const result = interpreter.interpret({
    rawConfig: {
      periodos: { manha: rawPeriodo() },
      dias_semana: [1, 2, 3, 4, 5],
    },
  });
  assertExists(result);
  assertEquals(result!.diasSemana, [1, 2, 3, 4, 5]);
});

Deno.test('ScheduleInterpreter — propaga minimumDate', () => {
  const result = interpreter.interpret({
    rawConfig: { periodos: { manha: rawPeriodo() } },
    minimumDate: '2026-04-10',
  });
  assertExists(result);
  assertEquals(result!.minimumDate, '2026-04-10');
});

Deno.test('ScheduleInterpreter — propaga ordemChegadaConfig', () => {
  const ordemConfig = {
    hora_chegada_inicio: '06:30',
    hora_chegada_fim: '11:00',
    mensagem: 'Retire sua senha a partir das 6h30',
  };
  const result = interpreter.interpret({
    rawConfig: {
      periodos: { manha: rawPeriodo() },
      ordem_chegada_config: ordemConfig,
    },
  });
  assertExists(result);
  assertEquals(result!.ordemChegadaConfig, ordemConfig);
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

Deno.test('ScheduleInterpreter — retorna null para rawConfig vazio', () => {
  assertEquals(interpreter.interpret({ rawConfig: {} }), null);
});

Deno.test('ScheduleInterpreter — retorna null quando periodos é null', () => {
  assertEquals(interpreter.interpret({ rawConfig: { periodos: null } }), null);
});
