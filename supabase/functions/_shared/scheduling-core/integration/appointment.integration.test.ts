/**
 * Testes de integração — AppointmentRepository + use cases contra banco real.
 *
 * Escopo:
 *   1. availability — countByPool/countByPeriod retornam valores reais
 *   2. book — criação atômica com idempotência gravada no INSERT
 *   3. book idempotente — segunda chamada com mesma chave retorna created:false
 *   4. cancel com race condition — segunda chamada lança InvalidStatusTransitionError
 *   5. countByPool reflete agendamento criado
 *
 * Como rodar:
 *   export SUPABASE_URL=https://pbkvwrordoqttyveohrd.supabase.co
 *   export SUPABASE_SERVICE_ROLE_KEY=<service_role_key_da_branch>
 *   deno task test:integration
 *
 * Nota: sanitizeResources/sanitizeOps desabilitados porque o Supabase client
 * mantém intervalos internos de realtime que não afetam a correção dos testes.
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { setupFixtures, futureDate } from './setup.ts';
import {
  SupabaseAppointmentRepository,
  BookAppointmentUseCase,
  CancelAppointmentUseCase,
  InvalidStatusTransitionError,
} from '../index.ts';

const TEST_OPTS = { sanitizeResources: false, sanitizeOps: false } as const;

// ─── Shared state ─────────────────────────────────────────────────────────────

let fixtures: Awaited<ReturnType<typeof setupFixtures>>;

async function getFixtures() {
  if (!fixtures) fixtures = await setupFixtures();
  return fixtures;
}

Deno.test({
  ...TEST_OPTS,
  name: 'integration:teardown',
  fn: async () => { if (fixtures) await fixtures.teardown(); },
});

// ─── 1. Availability ──────────────────────────────────────────────────────────

Deno.test({
  ...TEST_OPTS,
  name: 'integration — countByPool retorna 0 para dia sem agendamentos',
  fn: async () => {
    const { supabase, clienteId, medicoId } = await getFixtures();
    const repo = new SupabaseAppointmentRepository(supabase);

    const count = await repo.countByPool({
      medicoId, clienteId,
      date: futureDate(14),
      poolStart: '07:00',
      poolEnd: '12:00',
    });

    assertEquals(count, 0);
  },
});

Deno.test({
  ...TEST_OPTS,
  name: 'integration — countByPeriod retorna 0 para dia sem agendamentos',
  fn: async () => {
    const { supabase, clienteId, medicoId } = await getFixtures();
    const repo = new SupabaseAppointmentRepository(supabase);

    const count = await repo.countByPeriod({
      medicoId, clienteId,
      date: futureDate(14),
      start: '07:00',
      end: '12:00',
    });

    assertEquals(count, 0);
  },
});

// ─── 2. Book — criação atômica ────────────────────────────────────────────────

Deno.test({
  ...TEST_OPTS,
  name: 'integration — BookAppointmentUseCase cria agendamento no banco',
  fn: async () => {
    const { supabase, clienteId, medicoId, atendimentoId } = await getFixtures();
    const repo = new SupabaseAppointmentRepository(supabase);
    const useCase = new BookAppointmentUseCase(repo);

    const date = futureDate(7);
    const idempotencyKey = `test:${clienteId}:87900000001:${medicoId}:${date}:09:00:00`;

    const result = await useCase.execute({
      patient: {
        nomeCompleto: 'PACIENTE TESTE INTEGRACAO',
        dataNascimento: '1990-06-15',
        convenio: 'UNIMED',
        celular: '87900000001',
      },
      appointment: { medicoId, clienteId, atendimentoId, date, time: '09:00:00' },
      meta: { criadoPor: 'integration-test', idempotencyKey },
    });

    assertEquals(result.created, true);
    assertEquals(typeof result.appointmentId, 'string');

    // Confirma que idempotency_key foi gravada atomicamente no INSERT
    const { data } = await supabase
      .from('agendamentos')
      .select('idempotency_key, status')
      .eq('id', result.appointmentId)
      .single() as { data: { idempotency_key: string; status: string } | null };

    assertEquals(data?.idempotency_key, idempotencyKey);
    assertEquals(data?.status, 'agendado');
  },
});

// ─── 3. Book idempotente ──────────────────────────────────────────────────────

Deno.test({
  ...TEST_OPTS,
  name: 'integration — BookAppointmentUseCase é idempotente (mesma chave → created:false)',
  fn: async () => {
    const { supabase, clienteId, medicoId, atendimentoId } = await getFixtures();
    const repo = new SupabaseAppointmentRepository(supabase);
    const useCase = new BookAppointmentUseCase(repo);

    const date = futureDate(8);
    const idempotencyKey = `test:${clienteId}:87900000002:${medicoId}:${date}:10:00:00`;

    const first = await useCase.execute({
      patient: { nomeCompleto: 'PACIENTE TESTE IDEM', dataNascimento: '1985-03-20', convenio: 'UNIMED', celular: '87900000002' },
      appointment: { medicoId, clienteId, atendimentoId, date, time: '10:00:00' },
      meta: { criadoPor: 'integration-test', idempotencyKey },
    });
    assertEquals(first.created, true);

    const second = await useCase.execute({
      patient: { nomeCompleto: 'PACIENTE TESTE IDEM', dataNascimento: '1985-03-20', convenio: 'UNIMED', celular: '87900000002' },
      appointment: { medicoId, clienteId, atendimentoId, date, time: '10:00:00' },
      meta: { criadoPor: 'integration-test', idempotencyKey },
    });
    assertEquals(second.created, false);
    assertEquals(second.appointmentId, first.appointmentId);
  },
});

// ─── 4. Cancel com race condition ─────────────────────────────────────────────

Deno.test({
  ...TEST_OPTS,
  name: 'integration — cancel concorrente: segunda chamada lança InvalidStatusTransitionError',
  fn: async () => {
    const { supabase, clienteId, medicoId, atendimentoId } = await getFixtures();
    const repo = new SupabaseAppointmentRepository(supabase);
    const bookUseCase = new BookAppointmentUseCase(repo);
    const cancelUseCase = new CancelAppointmentUseCase(repo);

    const date = futureDate(9);
    const idempotencyKey = `test:${clienteId}:87900000003:${medicoId}:${date}:11:00:00`;

    const booked = await bookUseCase.execute({
      patient: { nomeCompleto: 'PACIENTE TESTE CANCEL', dataNascimento: '1978-11-01', convenio: 'UNIMED', celular: '87900000003' },
      appointment: { medicoId, clienteId, atendimentoId, date, time: '11:00:00' },
      meta: { criadoPor: 'integration-test', idempotencyKey },
    });
    assertEquals(booked.created, true);

    // Primeiro cancel — sucesso
    const cancelled = await cancelUseCase.execute({
      appointmentId: booked.appointmentId,
      clienteId,
      motivo: 'Teste de integração',
      canceladoPor: 'integration-test',
    });
    assertEquals(cancelled.previousStatus, 'booked');

    // Segundo cancel — deve falhar (UPDATE condicional afeta 0 linhas)
    await assertRejects(
      () => cancelUseCase.execute({
        appointmentId: booked.appointmentId,
        clienteId,
        motivo: 'Tentativa duplicada',
        canceladoPor: 'integration-test',
      }),
      InvalidStatusTransitionError,
    );
  },
});

// ─── 5. countByPool reflete agendamentos criados ──────────────────────────────

Deno.test({
  ...TEST_OPTS,
  name: 'integration — countByPool reflete agendamento criado',
  fn: async () => {
    const { supabase, clienteId, medicoId, atendimentoId } = await getFixtures();
    const repo = new SupabaseAppointmentRepository(supabase);
    const bookUseCase = new BookAppointmentUseCase(repo);

    const date = futureDate(10);
    const idempotencyKey = `test:${clienteId}:87900000004:${medicoId}:${date}:08:00:00`;

    const before = await repo.countByPool({ medicoId, clienteId, date, poolStart: '07:00', poolEnd: '12:00' });

    await bookUseCase.execute({
      patient: { nomeCompleto: 'PACIENTE TESTE COUNT', dataNascimento: '2000-01-01', convenio: 'UNIMED', celular: '87900000004' },
      appointment: { medicoId, clienteId, atendimentoId, date, time: '08:00:00' },
      meta: { criadoPor: 'integration-test', idempotencyKey },
    });

    const after = await repo.countByPool({ medicoId, clienteId, date, poolStart: '07:00', poolEnd: '12:00' });

    assertEquals(after, before + 1);
  },
});
