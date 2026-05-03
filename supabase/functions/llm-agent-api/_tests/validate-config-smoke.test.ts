// Smoke test: roda o validador contra a config viva do Dr. Marcelo (snapshot)
// pra detectar drift entre código e config em produção. Quando rodar localmente,
// puxa o JSON da DB de prod via Supabase MCP — ou usa o snapshot inline aqui.
//
// Snapshot capturado em 2026-05-01 (após migrations multi-tenant).
// Atualizar quando adicionarmos novos serviços ou mudar regras.
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { validateBusinessRulesConfig } from '../_lib/validate-config.ts';

const drMarceloSnapshot = {
  servicos: {
    MRPA: {
      tipo_agendamento: 'ordem_chegada',
      dias_semana: [2, 3, 4, 5],
      periodos: {
        manha: { inicio: '07:00', fim: '09:00', contagem_inicio: '07:00', contagem_fim: '12:00', limite: 5, dias_especificos: [3, 4, 5] },
        tarde: { inicio: '13:00', fim: '15:00', contagem_inicio: '12:00', contagem_fim: '18:00', limite: 5, dias_especificos: [2, 3, 4] },
      },
    },
    'MAPA 24H': {
      tipo: 'fixed_time',
      tipo_agendamento: 'hora_marcada',
      periodos: {
        segunda: { hora: '08:00', limite: 3, dias_especificos: [1] },
        terca:   { hora: '09:00', limite: 3, dias_especificos: [2] },
        quarta:  { hora: '10:00', limite: 3, dias_especificos: [3] },
        quinta:  { hora: '10:30', limite: 3, dias_especificos: [4] },
      },
    },
    'Teste Ergométrico': {
      tipo_agendamento: 'ordem_chegada',
      periodos: {
        manha: { inicio: '07:00', fim: '10:00', contagem_inicio: '07:00', contagem_fim: '12:00', limite: 13, dias_especificos: [3, 5] },
        tarde: { inicio: '13:00', fim: '15:00', contagem_inicio: '12:00', contagem_fim: '18:00', limite: 13, dias_especificos: [2, 4] },
      },
    },
    'Retorno Cardiológico': {
      tipo_agendamento: 'ordem_chegada',
      compartilha_limite_com: 'Consulta Cardiológica',
      periodos: {
        manha: { inicio: '07:00', fim: '10:00', contagem_inicio: '07:00', contagem_fim: '12:00', limite: 14, dias_especificos: [1, 2, 4] },
        tarde: { inicio: '13:00', fim: '15:00', contagem_inicio: '12:00', contagem_fim: '18:00', limite: 14, dias_especificos: [3] },
      },
    },
    'Consulta Cardiológica': {
      tipo_agendamento: 'ordem_chegada',
      compartilha_limite_com: 'Retorno Cardiológico',
      periodos: {
        manha: { inicio: '07:00', fim: '10:00', contagem_inicio: '07:00', contagem_fim: '12:00', limite: 14, dias_especificos: [1, 2, 4] },
        tarde: { inicio: '13:00', fim: '15:00', contagem_inicio: '12:00', contagem_fim: '18:00', limite: 14, dias_especificos: [3] },
      },
    },
    'ECG (Eletrocardiograma)': {
      tipo: 'walk_in_info_only',
      tipo_agendamento: 'ordem_chegada',
      periodos: {
        manha: { inicio: '07:00', fim: '10:00', contagem_inicio: '07:00', contagem_fim: '12:00', limite: 12, dias_especificos: [1, 2, 4] },
        tarde: { inicio: '13:00', fim: '15:00', contagem_inicio: '12:00', contagem_fim: '18:00', limite: 12, dias_especificos: [3] },
      },
    },
    'Agenda Particular Sexta Tarde': {
      oculto: true,
      tipo_agendamento: 'ordem_chegada',
      limite: 10,
      periodos: {
        tarde: { inicio: '13:00', fim: '15:00', limite: 10, dias_especificos: [5] },
      },
    },
  },
  medicos_relacionados: [
    'e6453b94-840d-4adf-ab0f-fc22be7cd7f5',
    '9d5d0e63-098b-4282-aa03-db3c7e012579',
  ],
};

Deno.test('validate-config: snapshot Dr. Marcelo (2026-05-01) está limpo (0 errors)', () => {
  const r = validateBusinessRulesConfig(drMarceloSnapshot);
  if (!r.ok || r.summary.errors > 0) {
    console.error('Findings:', JSON.stringify(r.findings, null, 2));
  }
  assertEquals(r.summary.errors, 0);
  assertEquals(r.ok, true);
});
