/**
 * Integration test multi-tenant — Sprint 1.3.
 *
 * Cria 2 clínicas em paralelo no mesmo schema do banco e valida que NENHUMA
 * query do scheduling-core vaza dados entre tenants. Cobre:
 *
 *   1. countByPool / countByPeriod — filtro cliente_id
 *   2. isSlotTaken — escopo correto
 *   3. findDuplicate — idempotency_key isolado por cliente_id
 *   4. findById — não retorna agendamento de outro tenant
 *
 * Esta é a rede de proteção mais importante pra produção multi-tenant —
 * uma única query sem cliente_id pode vazar dados de uma clínica pra outra.
 *
 * Como rodar:
 *   - Aponte SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY pra branch de teste
 *   - deno task test:integration
 */

import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { setupFixtures, futureDate } from './setup.ts';
import { SupabaseAppointmentRepository } from '../repositories/SupabaseAppointmentRepository.ts';

async function setupTwoTenants() {
  const tenantA = await setupFixtures();
  const tenantB = await setupFixtures();
  const teardown = async () => {
    await tenantA.teardown();
    await tenantB.teardown();
  };
  return { tenantA, tenantB, teardown };
}

// ────────────────────────────────────────────────────────────────────────────
// 1. countByPool — agendamentos do tenant B não contam pro tenant A
// ────────────────────────────────────────────────────────────────────────────
Deno.test({
  name: 'multi-tenant — countByPool isolado por cliente_id',
  ignore: !Deno.env.get('SUPABASE_URL'),
  fn: async () => {
    const { tenantA, tenantB, teardown } = await setupTwoTenants();
    try {
      const repoA = new SupabaseAppointmentRepository(tenantA.supabase);
      const date = futureDate(7);
      const time = '08:00:00';

      // Cria agendamento NO TENANT B
      await tenantB.supabase.from('agendamentos').insert({
        cliente_id:      tenantB.clienteId,
        medico_id:       tenantB.medicoId,
        atendimento_id:  tenantB.atendimentoId,
        data_agendamento: date,
        hora_agendamento: time,
        status:           'agendado',
        convenio:         'PARTICULAR',
        observacoes:      'multi-tenant test B',
        criado_por:       'integration-test',
        idempotency_key:  `${tenantB.clienteId}:test-pool:${date}:${time}`,
      });

      // Conta no TENANT A (mesma data/hora) — deve ver 0
      const countA = await repoA.countByPool({
        medicoId:  tenantA.medicoId,
        clienteId: tenantA.clienteId,
        date,
        poolStart: '07:00',
        poolEnd:   '12:00',
      });
      assertEquals(countA, 0, 'tenantA não pode ver agendamento de tenantB');

      // Conta no TENANT B — deve ver 1
      const repoB = new SupabaseAppointmentRepository(tenantB.supabase);
      const countB = await repoB.countByPool({
        medicoId:  tenantB.medicoId,
        clienteId: tenantB.clienteId,
        date,
        poolStart: '07:00',
        poolEnd:   '12:00',
      });
      assertEquals(countB, 1, 'tenantB deve ver seu próprio agendamento');
    } finally {
      await teardown();
    }
  },
});

// ────────────────────────────────────────────────────────────────────────────
// 2. countByPeriod — mesma proteção pra modo time_slot
// ────────────────────────────────────────────────────────────────────────────
Deno.test({
  name: 'multi-tenant — countByPeriod isolado por cliente_id',
  ignore: !Deno.env.get('SUPABASE_URL'),
  fn: async () => {
    const { tenantA, tenantB, teardown } = await setupTwoTenants();
    try {
      const date = futureDate(7);
      const time = '09:00:00';

      await tenantB.supabase.from('agendamentos').insert({
        cliente_id:      tenantB.clienteId,
        medico_id:       tenantB.medicoId,
        atendimento_id:  tenantB.atendimentoId,
        data_agendamento: date,
        hora_agendamento: time,
        status:           'agendado',
        convenio:         'PARTICULAR',
        criado_por:       'integration-test',
        idempotency_key:  `${tenantB.clienteId}:test-period:${date}:${time}`,
      });

      const repoA = new SupabaseAppointmentRepository(tenantA.supabase);
      const countA = await repoA.countByPeriod({
        medicoId:  tenantA.medicoId,
        clienteId: tenantA.clienteId,
        date,
        start: '07:00',
        end:   '12:00',
      });
      assertEquals(countA, 0);
    } finally {
      await teardown();
    }
  },
});

// ────────────────────────────────────────────────────────────────────────────
// 3. isSlotTaken — slot de outro tenant NÃO bloqueia o seu
// ────────────────────────────────────────────────────────────────────────────
Deno.test({
  name: 'multi-tenant — isSlotTaken isolado por cliente_id',
  ignore: !Deno.env.get('SUPABASE_URL'),
  fn: async () => {
    const { tenantA, tenantB, teardown } = await setupTwoTenants();
    try {
      const date = futureDate(7);
      const time = '10:00:00';

      // tenant B ocupa o slot
      await tenantB.supabase.from('agendamentos').insert({
        cliente_id:      tenantB.clienteId,
        medico_id:       tenantB.medicoId,
        atendimento_id:  tenantB.atendimentoId,
        data_agendamento: date,
        hora_agendamento: time,
        status:           'agendado',
        convenio:         'PARTICULAR',
        criado_por:       'integration-test',
        idempotency_key:  `${tenantB.clienteId}:test-slot:${date}:${time}`,
      });

      const repoA = new SupabaseAppointmentRepository(tenantA.supabase);
      // Mesmo medico_id de tenantA mas slot só está ocupado em tenantB
      const taken = await repoA.isSlotTaken({
        medicoId:  tenantA.medicoId,
        clienteId: tenantA.clienteId,
        date,
        time,
      });
      assertEquals(taken, false);
    } finally {
      await teardown();
    }
  },
});

// ────────────────────────────────────────────────────────────────────────────
// 4. findDuplicate — mesma idempotency_key em tenants diferentes não colide
// ────────────────────────────────────────────────────────────────────────────
Deno.test({
  name: 'multi-tenant — findDuplicate filtra por cliente_id',
  ignore: !Deno.env.get('SUPABASE_URL'),
  fn: async () => {
    const { tenantA, tenantB, teardown } = await setupTwoTenants();
    try {
      const date = futureDate(7);
      const time = '11:00:00';

      // mesma idempotency_key aplicada em tenant B
      const sharedKey = `shared:test-dup:${date}:${time}`;
      await tenantB.supabase.from('agendamentos').insert({
        cliente_id:      tenantB.clienteId,
        medico_id:       tenantB.medicoId,
        atendimento_id:  tenantB.atendimentoId,
        data_agendamento: date,
        hora_agendamento: time,
        status:           'agendado',
        convenio:         'PARTICULAR',
        criado_por:       'integration-test',
        idempotency_key:  sharedKey,
      });

      // tenant A busca pela MESMA key — não deve encontrar
      const repoA = new SupabaseAppointmentRepository(tenantA.supabase);
      const dupA = await repoA.findDuplicate({
        idempotencyKey: sharedKey,
        clienteId:      tenantA.clienteId,
      });
      assertEquals(dupA.found, false);

      // tenant B busca pela mesma key — deve encontrar o seu próprio
      const repoB = new SupabaseAppointmentRepository(tenantB.supabase);
      const dupB = await repoB.findDuplicate({
        idempotencyKey: sharedKey,
        clienteId:      tenantB.clienteId,
      });
      assertEquals(dupB.found, true);
    } finally {
      await teardown();
    }
  },
});

// ────────────────────────────────────────────────────────────────────────────
// 5. findById — não retorna agendamento de outro tenant
// ────────────────────────────────────────────────────────────────────────────
Deno.test({
  name: 'multi-tenant — findById não vaza agendamento de outro tenant',
  ignore: !Deno.env.get('SUPABASE_URL'),
  fn: async () => {
    const { tenantA, tenantB, teardown } = await setupTwoTenants();
    try {
      const date = futureDate(7);
      const time = '14:00:00';

      // cria em B e captura o id
      const { data: insertedB } = await tenantB.supabase.from('agendamentos').insert({
        cliente_id:      tenantB.clienteId,
        medico_id:       tenantB.medicoId,
        atendimento_id:  tenantB.atendimentoId,
        data_agendamento: date,
        hora_agendamento: time,
        status:           'agendado',
        convenio:         'PARTICULAR',
        criado_por:       'integration-test',
        idempotency_key:  `${tenantB.clienteId}:test-findby:${date}:${time}`,
      }).select('id').single();
      const idB = insertedB!.id;

      // tenant A tenta carregar pelo id de B com SEU cliente_id
      const repoA = new SupabaseAppointmentRepository(tenantA.supabase);
      const got = await repoA.findById({ id: idB, clienteId: tenantA.clienteId });
      assertEquals(got, null, 'findById com cliente_id errado deve retornar null');

      // tenant B carrega normalmente
      const repoB = new SupabaseAppointmentRepository(tenantB.supabase);
      const okGot = await repoB.findById({ id: idB, clienteId: tenantB.clienteId });
      assert(okGot !== null);
      assertEquals(okGot!.id, idB);
    } finally {
      await teardown();
    }
  },
});
