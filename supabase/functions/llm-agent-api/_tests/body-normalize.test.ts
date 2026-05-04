// Testes do middleware de normalização de body (Postel's Law).
//
// Cobertura crítica:
//   1. '' e null em campos opcionais → omitidos antes da validação
//   2. UUID malformado (valor presente E inválido) → continua erro 400
//   3. Tipos errados → continuam erro 400
//   4. Body já limpo passa sem mudança
//   5. Não-objetos retornam unchanged

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { normalizeRequestBody } from '../_lib/body-normalize.ts';
import { validateAvailabilityRequest, validateBaseRequest } from '../_lib/schema-validation.ts';

// ─── normalizeRequestBody (unidade isolada) ──────────────────────────────────

Deno.test('normalize: string vazia removida', () => {
  const out = normalizeRequestBody({ cliente_id: 'uuid', config_id: '' });
  assertEquals(out, { cliente_id: 'uuid' });
});

Deno.test('normalize: null removido', () => {
  const out = normalizeRequestBody({ cliente_id: 'uuid', config_id: null });
  assertEquals(out, { cliente_id: 'uuid' });
});

Deno.test('normalize: undefined naturalmente ausente', () => {
  const out = normalizeRequestBody({ cliente_id: 'uuid', config_id: undefined });
  assertEquals(out, { cliente_id: 'uuid' });
});

Deno.test('normalize: valor presente preservado', () => {
  const out = normalizeRequestBody({
    cliente_id: 'uuid',
    config_id: '00000000-0000-0000-0000-000000000000',
    quantidade_dias: 7,
    buscar_proximas: true,
    allowed_doctor_ids: ['id1', 'id2'],
  });
  assertEquals(out, {
    cliente_id: 'uuid',
    config_id: '00000000-0000-0000-0000-000000000000',
    quantidade_dias: 7,
    buscar_proximas: true,
    allowed_doctor_ids: ['id1', 'id2'],
  });
});

Deno.test('normalize: zero e false NÃO são removidos (são valores válidos)', () => {
  const out = normalizeRequestBody({ cliente_id: 'uuid', quantidade_dias: 0, buscar_proximas: false });
  assertEquals(out, { cliente_id: 'uuid', quantidade_dias: 0, buscar_proximas: false });
});

Deno.test('normalize: array vazio é preservado (handler decide se tem semântica)', () => {
  const out = normalizeRequestBody({ cliente_id: 'uuid', allowed_doctor_ids: [] });
  assertEquals(out, { cliente_id: 'uuid', allowed_doctor_ids: [] });
});

Deno.test('normalize: body não-objeto retorna unchanged', () => {
  assertEquals(normalizeRequestBody(null), null);
  assertEquals(normalizeRequestBody(undefined), undefined);
  assertEquals(normalizeRequestBody('string'), 'string');
  assertEquals(normalizeRequestBody(42), 42);
});

Deno.test('normalize: array preservado (defesa downstream em index.ts já faz extract)', () => {
  const arr = [{ a: 1 }];
  assertEquals(normalizeRequestBody(arr), arr);
});

// ─── Integração: normalize + validateAvailabilityRequest ─────────────────────

const VALID_UUID = '12345678-1234-1234-1234-123456789012';

Deno.test('integração: config_id="" passa após normalize (era erro antes)', () => {
  const raw = { cliente_id: VALID_UUID, config_id: '', medico_nome: 'Dr. X' };
  const normalized = normalizeRequestBody(raw);
  const errs = validateAvailabilityRequest(normalized);
  assertEquals(errs, []);
});

Deno.test('integração: config_id="abc" continua erro (valor presente E malformado)', () => {
  const raw = { cliente_id: VALID_UUID, config_id: 'abc' };
  const normalized = normalizeRequestBody(raw);
  const errs = validateAvailabilityRequest(normalized);
  assertEquals(errs.length, 1);
  assertEquals(errs[0].field, 'config_id');
  assertEquals(errs[0].rule, 'uuid');
});

Deno.test('integração: cliente_id="" continua erro (obrigatório)', () => {
  const raw = { cliente_id: '' };
  const normalized = normalizeRequestBody(raw);
  const errs = validateBaseRequest(normalized);
  assertEquals(errs.length, 1);
  assertEquals(errs[0].field, 'cliente_id');
  assertEquals(errs[0].rule, 'required');
});

Deno.test('integração: data_consulta="" passa após normalize', () => {
  const raw = { cliente_id: VALID_UUID, data_consulta: '' };
  const normalized = normalizeRequestBody(raw);
  const errs = validateAvailabilityRequest(normalized);
  assertEquals(errs, []);
});

Deno.test('integração: periodo="" passa após normalize', () => {
  const raw = { cliente_id: VALID_UUID, periodo: '' };
  const normalized = normalizeRequestBody(raw);
  const errs = validateAvailabilityRequest(normalized);
  assertEquals(errs, []);
});

Deno.test('integração: periodo="ambos" continua erro (valor presente E inválido)', () => {
  const raw = { cliente_id: VALID_UUID, periodo: 'ambos' };
  const normalized = normalizeRequestBody(raw);
  const errs = validateAvailabilityRequest(normalized);
  assertEquals(errs.length, 1);
  assertEquals(errs[0].field, 'periodo');
  assertEquals(errs[0].rule, 'enum');
});

Deno.test('integração: body realista n8n (tudo "" exceto obrigatórios) passa', () => {
  const raw = {
    cliente_id: VALID_UUID,
    config_id: '',
    medico_nome: 'Dr. Marcelo',
    atendimento_nome: 'Consulta',
    data_consulta: '2026-05-15',
    periodo: '',
    mensagem_original: '',
    buscar_proximas: true,
  };
  const normalized = normalizeRequestBody(raw);
  const errs = validateAvailabilityRequest(normalized);
  assertEquals(errs, []);
  // Sanity: chaves vazias não vazaram pra validator
  assertEquals('config_id' in normalized, false);
  assertEquals('periodo' in normalized, false);
  assertEquals('mensagem_original' in normalized, false);
});
