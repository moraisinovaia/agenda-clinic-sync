/**
 * Smoke concorrente de idempotência — Sprint 2.3.
 *
 * Valida que 2 chamadas simultâneas com a MESMA `idempotency_key` resultam
 * num único agendamento criado, e que ambas as chamadas retornam o mesmo
 * `agendamento_id` (sem erros de unique_violation expostos pro caller).
 *
 * Fluxo realista de prod:
 *   - n8n dispara worker A
 *   - timeout / network blip (sem confirmação chegou)
 *   - n8n dispara worker B (retry) com a MESMA key
 *   - Esperado: ambos retornam mesmo id, sem duplicatas no banco
 *
 * Cobre o patch `rpc_idempotency_unique_violation_handler` (Etapa F):
 *   - Worker A: INSERT ✅ → success:true, agendamento_id
 *   - Worker B: INSERT viola UNIQUE → handler captura → SELECT existing →
 *     retorna success:true, agendamento_id, idempotency_hit:true
 *
 * Como rodar:
 *   - SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY apontando pra branch de teste
 *   - deno task test:integration
 */

import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { setupFixtures, futureDate } from './setup.ts';
import { SupabaseAppointmentRepository } from '../repositories/SupabaseAppointmentRepository.ts';
import { BookAppointmentUseCase } from '../use-cases/BookAppointmentUseCase.ts';

Deno.test({
  name: 'idempotency-race — 2 chamadas paralelas com mesma key → 1 agendamento, ambos retornam mesmo id',
  ignore: !Deno.env.get('SUPABASE_URL'),
  fn: async () => {
    const fixt = await setupFixtures();
    try {
      const repo = new SupabaseAppointmentRepository(fixt.supabase);
      const useCase = new BookAppointmentUseCase(repo);

      const date = futureDate(7);
      const time = '08:00:00';
      const idempotencyKey = `race-test-${Date.now()}-${Math.random()}`;

      const inputBase = {
        patient: {
          nomeCompleto:   'PACIENTE TESTE RACE',
          dataNascimento: '1990-01-01',
          convenio:       'PARTICULAR',
          celular:        '11999999999',
          telefone:       null,
        },
        appointment: {
          medicoId:       fixt.medicoId,
          clienteId:      fixt.clienteId,
          atendimentoId:  fixt.atendimentoId,
          date,
          time,
          observacoes:    'race condition smoke test',
        },
        meta: {
          criadoPor:      'integration-test',
          idempotencyKey,
        },
      };

      // Disparar 2 chamadas paralelas
      const [resultA, resultB] = await Promise.all([
        useCase.execute(inputBase),
        useCase.execute(inputBase),
      ]);

      // Ambas devem retornar o MESMO agendamento_id
      assertEquals(
        resultA.appointmentId,
        resultB.appointmentId,
        'ambas as chamadas devem apontar pro mesmo agendamento',
      );

      // Pelo menos UMA delas é created=false (a segunda hit a idempotência)
      // OU as 2 acharam duplicata na fase findDuplicate (também válido).
      assert(
        resultA.created !== resultB.created
        || (!resultA.created && !resultB.created),
        'ambas como created=true indica race no findDuplicate; só uma deve criar',
      );

      // Validar no banco: APENAS 1 agendamento ativo
      const { data: todos } = await fixt.supabase
        .from('agendamentos')
        .select('id, idempotency_key, status')
        .eq('cliente_id',      fixt.clienteId)
        .eq('idempotency_key', idempotencyKey)
        .is('cancelado_em', null)
        .is('excluido_em', null);

      assertEquals(todos!.length, 1, `esperava 1 agendamento, achou ${todos!.length}`);
      assertEquals(todos![0].id, resultA.appointmentId);
    } finally {
      await fixt.teardown();
    }
  },
});

Deno.test({
  name: 'idempotency-race — 5 chamadas paralelas com mesma key → ainda 1 agendamento',
  ignore: !Deno.env.get('SUPABASE_URL'),
  fn: async () => {
    const fixt = await setupFixtures();
    try {
      const repo = new SupabaseAppointmentRepository(fixt.supabase);
      const useCase = new BookAppointmentUseCase(repo);

      const date = futureDate(8);
      const time = '09:00:00';
      const idempotencyKey = `race-test-5x-${Date.now()}-${Math.random()}`;

      const inputBase = {
        patient: {
          nomeCompleto:   'PACIENTE TESTE 5X',
          dataNascimento: '1990-01-01',
          convenio:       'PARTICULAR',
          celular:        '11888888888',
          telefone:       null,
        },
        appointment: {
          medicoId:       fixt.medicoId,
          clienteId:      fixt.clienteId,
          atendimentoId:  fixt.atendimentoId,
          date,
          time,
          observacoes:    'race 5x',
        },
        meta: {
          criadoPor:      'integration-test',
          idempotencyKey,
        },
      };

      const results = await Promise.all([
        useCase.execute(inputBase),
        useCase.execute(inputBase),
        useCase.execute(inputBase),
        useCase.execute(inputBase),
        useCase.execute(inputBase),
      ]);

      // Todas devem ter o mesmo agendamento_id
      const ids = new Set(results.map((r) => r.appointmentId));
      assertEquals(ids.size, 1, `todas as 5 chamadas deviam retornar mesmo id, retornaram ${ids.size}`);

      // No banco: 1 agendamento
      const { data: todos } = await fixt.supabase
        .from('agendamentos')
        .select('id')
        .eq('cliente_id',      fixt.clienteId)
        .eq('idempotency_key', idempotencyKey)
        .is('cancelado_em', null)
        .is('excluido_em', null);

      assertEquals(todos!.length, 1);
    } finally {
      await fixt.teardown();
    }
  },
});
