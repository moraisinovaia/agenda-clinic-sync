/**
 * Setup de fixtures para testes de integração.
 *
 * Cria dados mínimos no banco de teste (branch) e retorna IDs para uso nos testes.
 * Teardown remove tudo criado — nunca toca em dados pré-existentes.
 *
 * Pré-condições:
 *   - SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem apontar para a branch de teste
 *   - Executar: deno task test:integration
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface TestFixtures {
  supabase: any;
  clienteId: string;
  medicoId: string;
  atendimentoId: string;
  /** Limpa todos os dados criados nesta sessão */
  teardown: () => Promise<void>;
}

export async function setupFixtures(): Promise<TestFixtures> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.\n' +
      'Aponte para a branch de testes antes de rodar: deno task test:integration'
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // ─── Cliente ────────────────────────────────────────────────────────────────
  const { data: cliente, error: clienteErr } = await supabase
    .from('clientes')
    .insert({ nome: '[TEST] Clínica Integração', ativo: true })
    .select('id')
    .single();

  if (clienteErr || !cliente) throw new Error(`Falha ao criar cliente: ${clienteErr?.message}`);
  const clienteId = cliente.id;

  // ─── Médico ──────────────────────────────────────────────────────────────────
  const { data: medico, error: medicoErr } = await supabase
    .from('medicos')
    .insert({
      nome: '[TEST] Dr. Integração',
      cliente_id: clienteId,
      ativo: true,
      crm: 'TEST-99999',
      convenios_aceitos: ['UNIMED', 'PARTICULAR'],
    })
    .select('id')
    .single();

  if (medicoErr || !medico) throw new Error(`Falha ao criar médico: ${medicoErr?.message}`);
  const medicoId = medico.id;

  // ─── Atendimento ─────────────────────────────────────────────────────────────
  const { data: atendimento, error: atendErr } = await supabase
    .from('atendimentos')
    .insert({
      nome: '[TEST] Consulta Integração',
      cliente_id: clienteId,
      ativo: true,
    })
    .select('id')
    .single();

  if (atendErr || !atendimento) throw new Error(`Falha ao criar atendimento: ${atendErr?.message}`);
  const atendimentoId = atendimento.id;

  // ─── Teardown ────────────────────────────────────────────────────────────────
  const teardown = async () => {
    // Ordem respeita FK: agendamentos → pacientes → atendimentos → medicos → clientes
    await supabase.from('agendamentos').delete().eq('cliente_id', clienteId);
    await supabase.from('pacientes').delete().eq('cliente_id', clienteId);
    await supabase.from('atendimentos').delete().eq('cliente_id', clienteId);
    await supabase.from('medicos').delete().eq('cliente_id', clienteId);
    await supabase.from('clientes').delete().eq('id', clienteId);
  };

  return { supabase, clienteId, medicoId, atendimentoId, teardown };
}

/** Data futura segura para agendamento (D+7) */
export function futureDate(offsetDays = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  // Pular fim de semana
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}
