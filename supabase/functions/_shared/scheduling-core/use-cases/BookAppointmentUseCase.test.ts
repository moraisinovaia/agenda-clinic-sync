import { assertEquals, assertRejects } from '@std/assert';
import { BookAppointmentUseCase } from './BookAppointmentUseCase.ts';
import {
  SlotAlreadyTakenError,
  DuplicateBookingError,
} from '../domain/types.ts';
import type { AppointmentRepository } from '../interfaces/AppointmentRepository.ts';
import type { BookAppointmentInput } from '../domain/types.ts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<BookAppointmentInput> = {}): BookAppointmentInput {
  return {
    patient: {
      nomeCompleto: 'JOAO DA SILVA',
      dataNascimento: '1990-01-01',
      convenio: 'UNIMED',
      celular: '87999990000',
    },
    appointment: {
      medicoId: 'medico-1',
      clienteId: 'client-1',
      atendimentoId: 'atend-1',
      date: '2026-05-01',
      time: '08:00:00',
    },
    meta: {
      criadoPor: 'llm-agent',
      idempotencyKey: 'client-1:87999990000:medico-1:2026-05-01:08:00:00',
    },
    ...overrides,
  };
}

function makeRepo(overrides: Partial<AppointmentRepository> = {}): AppointmentRepository {
  return {
    countByPeriod: () => Promise.resolve(0),
    countByPool: () => Promise.resolve(0),
    isSlotTaken: () => Promise.resolve(false),
    findDuplicate: () => Promise.resolve({ found: false }),
    create: () => Promise.resolve({ appointmentId: 'appt-new', patientId: 'paciente-1' }),
    findById: () => Promise.resolve(null),
    cancel: () => Promise.resolve(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

Deno.test('BookAppointmentUseCase — cria agendamento com sucesso', async () => {
  const repo = makeRepo();
  const useCase = new BookAppointmentUseCase(repo);

  const result = await useCase.execute(makeInput());

  assertEquals(result.appointmentId, 'appt-new');
  assertEquals(result.patientId, 'paciente-1');
  assertEquals(result.created, true);
});

Deno.test('BookAppointmentUseCase — retorna created:false para chamada idempotente (duplicata encontrada)', async () => {
  const repo = makeRepo({
    findDuplicate: () => Promise.resolve({
      found: true,
      appointmentId: 'appt-existente',
      patientId: 'paciente-1',
    }),
  });
  const useCase = new BookAppointmentUseCase(repo);

  const result = await useCase.execute(makeInput());

  assertEquals(result.created, false);
  assertEquals(result.appointmentId, 'appt-existente');
});

Deno.test('BookAppointmentUseCase — lança SlotAlreadyTakenError quando horário ocupado', async () => {
  const repo = makeRepo({
    isSlotTaken: () => Promise.resolve(true),
  });
  const useCase = new BookAppointmentUseCase(repo);

  const err = await assertRejects(
    () => useCase.execute(makeInput()),
    SlotAlreadyTakenError,
  ) as SlotAlreadyTakenError;

  assertEquals(err.medicoId, 'medico-1');
  assertEquals(err.date, '2026-05-01');
  assertEquals(err.time, '08:00:00');
});

Deno.test('BookAppointmentUseCase — não checa slot se duplicata já encontrada (atalho idempotente)', async () => {
  let isSlotTakenCalled = false;

  const repo = makeRepo({
    findDuplicate: () => Promise.resolve({ found: true, appointmentId: 'appt-x', patientId: 'p-1' }),
    isSlotTaken: () => {
      isSlotTakenCalled = true;
      return Promise.resolve(true);
    },
  });
  const useCase = new BookAppointmentUseCase(repo);

  await useCase.execute(makeInput());

  assertEquals(isSlotTakenCalled, false);
});

Deno.test('BookAppointmentUseCase — não chama create se slot tomado', async () => {
  let createCalled = false;

  const repo = makeRepo({
    isSlotTaken: () => Promise.resolve(true),
    create: () => {
      createCalled = true;
      return Promise.resolve({ appointmentId: 'x', patientId: 'x' });
    },
  });
  const useCase = new BookAppointmentUseCase(repo);

  await assertRejects(() => useCase.execute(makeInput()), SlotAlreadyTakenError);

  assertEquals(createCalled, false);
});

Deno.test('BookAppointmentUseCase — propaga DuplicateBookingError do repo', async () => {
  const repo = makeRepo({
    create: () => Promise.reject(new DuplicateBookingError('appt-dup', 'pac-dup')),
  });
  const useCase = new BookAppointmentUseCase(repo);

  await assertRejects(
    () => useCase.execute(makeInput()),
    DuplicateBookingError,
  );
});

Deno.test('BookAppointmentUseCase — idempotencyKey é passado para findDuplicate', async () => {
  let capturedKey: string | undefined;

  const repo = makeRepo({
    findDuplicate: ({ idempotencyKey }) => {
      capturedKey = idempotencyKey;
      return Promise.resolve({ found: false });
    },
  });
  const useCase = new BookAppointmentUseCase(repo);

  const input = makeInput();
  await useCase.execute(input);

  assertEquals(capturedKey, input.meta.idempotencyKey);
});
