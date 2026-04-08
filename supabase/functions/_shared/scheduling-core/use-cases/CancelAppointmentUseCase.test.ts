import { assertEquals, assertRejects } from '@std/assert';
import { CancelAppointmentUseCase } from './CancelAppointmentUseCase.ts';
import {
  AppointmentNotFoundError,
  InvalidStatusTransitionError,
} from '../domain/types.ts';
import type { AppointmentRepository } from '../interfaces/AppointmentRepository.ts';
import type { AppointmentDetails } from '../domain/types.ts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAppointment(overrides: Partial<AppointmentDetails> = {}): AppointmentDetails {
  return {
    id: 'appt-1',
    clienteId: 'client-1',
    medicoId: 'medico-1',
    atendimentoId: 'atend-1',
    pacienteId: 'paciente-1',
    date: '2026-05-01',
    time: '08:00:00',
    status: 'booked',
    ...overrides,
  };
}

function makeRepo(overrides: Partial<AppointmentRepository> = {}): AppointmentRepository {
  return {
    countByPeriod: () => Promise.resolve(0),
    countByPool: () => Promise.resolve(0),
    isSlotTaken: () => Promise.resolve(false),
    findDuplicate: () => Promise.resolve({ found: false }),
    create: () => Promise.resolve({ appointmentId: 'appt-1', patientId: 'paciente-1' }),
    findById: () => Promise.resolve(makeAppointment()),
    cancel: () => Promise.resolve(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

Deno.test('CancelAppointmentUseCase — cancela agendamento com status booked', async () => {
  const repo = makeRepo();
  const useCase = new CancelAppointmentUseCase(repo);

  const result = await useCase.execute({
    appointmentId: 'appt-1',
    clienteId: 'client-1',
    canceladoPor: 'paciente',
  });

  assertEquals(result.appointmentId, 'appt-1');
  assertEquals(result.previousStatus, 'booked');
});

Deno.test('CancelAppointmentUseCase — cancela agendamento com status confirmed', async () => {
  const repo = makeRepo({
    findById: () => Promise.resolve(makeAppointment({ status: 'confirmed' })),
  });
  const useCase = new CancelAppointmentUseCase(repo);

  const result = await useCase.execute({
    appointmentId: 'appt-1',
    clienteId: 'client-1',
    canceladoPor: 'secretaria',
  });

  assertEquals(result.previousStatus, 'confirmed');
});

Deno.test('CancelAppointmentUseCase — lança AppointmentNotFoundError quando agendamento não existe', async () => {
  const repo = makeRepo({
    findById: () => Promise.resolve(null),
  });
  const useCase = new CancelAppointmentUseCase(repo);

  await assertRejects(
    () => useCase.execute({ appointmentId: 'appt-x', clienteId: 'client-1', canceladoPor: 'sistema' }),
    AppointmentNotFoundError,
    'appt-x',
  );
});

Deno.test('CancelAppointmentUseCase — lança InvalidStatusTransitionError quando já cancelado (check no use case)', async () => {
  const repo = makeRepo({
    findById: () => Promise.resolve(makeAppointment({ status: 'cancelled' })),
  });
  const useCase = new CancelAppointmentUseCase(repo);

  await assertRejects(
    () => useCase.execute({ appointmentId: 'appt-1', clienteId: 'client-1', canceladoPor: 'sistema' }),
    InvalidStatusTransitionError,
  );
});

Deno.test('CancelAppointmentUseCase — propaga InvalidStatusTransitionError do repo (race condition)', async () => {
  // Simula: findById retorna booked, mas o UPDATE no repo encontra 0 linhas
  // (outro worker cancelou entre o findById e o UPDATE)
  const repo = makeRepo({
    findById: () => Promise.resolve(makeAppointment({ status: 'booked' })),
    cancel: () => Promise.reject(new InvalidStatusTransitionError('cancelled')),
  });
  const useCase = new CancelAppointmentUseCase(repo);

  await assertRejects(
    () => useCase.execute({ appointmentId: 'appt-1', clienteId: 'client-1', canceladoPor: 'sistema' }),
    InvalidStatusTransitionError,
  );
});

Deno.test('CancelAppointmentUseCase — tenant isolation: findById recebe clienteId correto', async () => {
  let capturedClienteId: string | undefined;

  const repo = makeRepo({
    findById: ({ id, clienteId }) => {
      capturedClienteId = clienteId;
      return Promise.resolve(makeAppointment({ id, clienteId }));
    },
  });
  const useCase = new CancelAppointmentUseCase(repo);

  await useCase.execute({ appointmentId: 'appt-1', clienteId: 'tenant-abc', canceladoPor: 'sistema' });

  assertEquals(capturedClienteId, 'tenant-abc');
});
