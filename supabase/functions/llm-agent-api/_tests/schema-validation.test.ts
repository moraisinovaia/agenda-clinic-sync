// Tests do schema validator (F9.1)
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  validateAvailabilityRequest,
  validateScheduleRequest,
  validateAgendamentoIdRequest,
  validateChatRequest,
  validateFilaRequest,
  validatePatientSearchRequest,
  isUuid, isIsoOrBrDate, isHora,
} from '../_lib/schema-validation.ts';

const VALID_UUID = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';

Deno.test('isUuid: aceita UUIDs válidos, rejeita inválidos', () => {
  assert(isUuid(VALID_UUID));
  assert(!isUuid(''));
  assert(!isUuid(null));
  assert(!isUuid('not-a-uuid'));
  assert(!isUuid('2bfb98b5-ae41-4f96-8ba7'));
  // case-insensitive
  assert(isUuid('2BFB98B5-AE41-4F96-8BA7-ACC797C22054'));
});

Deno.test('isIsoOrBrDate: aceita YYYY-MM-DD e DD/MM/YYYY', () => {
  assert(isIsoOrBrDate('2026-05-08'));
  assert(isIsoOrBrDate('08/05/2026'));
  assert(!isIsoOrBrDate('2026/05/08'));
  assert(!isIsoOrBrDate('2026-13-08'));  // mês inválido
  assert(!isIsoOrBrDate('2026-05-32'));  // dia inválido
  assert(!isIsoOrBrDate(''));
  assert(!isIsoOrBrDate(null));
});

Deno.test('isHora: aceita HH:MM e HH:MM:SS', () => {
  assert(isHora('07:00'));
  assert(isHora('23:59'));
  assert(isHora('07:00:00'));
  assert(!isHora('25:00'));
  assert(!isHora('7:00'));    // sem zero à esquerda
  assert(!isHora(''));
});

Deno.test('validateAvailabilityRequest: body válido mínimo → sem erros', () => {
  const errs = validateAvailabilityRequest({ cliente_id: VALID_UUID });
  assertEquals(errs.length, 0);
});

Deno.test('validateAvailabilityRequest: cliente_id ausente → erro', () => {
  const errs = validateAvailabilityRequest({});
  assert(errs.some((e) => e.field === 'cliente_id' && e.rule === 'required'));
});

Deno.test('validateAvailabilityRequest: cliente_id não UUID → erro', () => {
  const errs = validateAvailabilityRequest({ cliente_id: '123' });
  assert(errs.some((e) => e.field === 'cliente_id' && e.rule === 'uuid'));
});

Deno.test('validateAvailabilityRequest: data_consulta inválida → erro', () => {
  const errs = validateAvailabilityRequest({ cliente_id: VALID_UUID, data_consulta: '2026-13-08' });
  assert(errs.some((e) => e.field === 'data_consulta' && e.rule === 'date_format'));
});

Deno.test('validateAvailabilityRequest: data_consulta ISO ok', () => {
  const errs = validateAvailabilityRequest({ cliente_id: VALID_UUID, data_consulta: '2026-05-08' });
  assertEquals(errs.length, 0);
});

Deno.test('validateAvailabilityRequest: data_consulta vazia ignorada', () => {
  const errs = validateAvailabilityRequest({ cliente_id: VALID_UUID, data_consulta: '' });
  assertEquals(errs.length, 0);
});

Deno.test('validateAvailabilityRequest: periodo enum', () => {
  assertEquals(validateAvailabilityRequest({ cliente_id: VALID_UUID, periodo: 'manha' }).length, 0);
  assertEquals(validateAvailabilityRequest({ cliente_id: VALID_UUID, periodo: 'tarde' }).length, 0);
  assert(validateAvailabilityRequest({ cliente_id: VALID_UUID, periodo: 'noite' }).some((e) => e.rule === 'enum'));
});

Deno.test('validateAvailabilityRequest: quantidade_dias range', () => {
  assertEquals(validateAvailabilityRequest({ cliente_id: VALID_UUID, quantidade_dias: 30 }).length, 0);
  assert(validateAvailabilityRequest({ cliente_id: VALID_UUID, quantidade_dias: 0 }).some((e) => e.rule === 'range'));
  assert(validateAvailabilityRequest({ cliente_id: VALID_UUID, quantidade_dias: 999 }).some((e) => e.rule === 'range'));
  assert(validateAvailabilityRequest({ cliente_id: VALID_UUID, quantidade_dias: '30' }).some((e) => e.rule === 'range'));
});

Deno.test('validateAvailabilityRequest: allowed_doctor_ids deve ser array de uuid', () => {
  assertEquals(validateAvailabilityRequest({
    cliente_id: VALID_UUID,
    allowed_doctor_ids: [VALID_UUID],
  }).length, 0);
  assert(validateAvailabilityRequest({
    cliente_id: VALID_UUID,
    allowed_doctor_ids: 'not-array',
  }).some((e) => e.rule === 'string_array'));
  assert(validateAvailabilityRequest({
    cliente_id: VALID_UUID,
    allowed_doctor_ids: ['not-uuid'],
  }).some((e) => e.field === 'allowed_doctor_ids[0]' && e.rule === 'uuid'));
});

Deno.test('validateScheduleRequest: paciente_nome e celular obrigatórios', () => {
  const errs = validateScheduleRequest({ cliente_id: VALID_UUID });
  assert(errs.some((e) => e.field === 'paciente_nome'));
  assert(errs.some((e) => e.field === 'celular'));
});

Deno.test('validateAgendamentoIdRequest: agendamento_id obrigatório UUID', () => {
  assert(validateAgendamentoIdRequest({ cliente_id: VALID_UUID }).some((e) => e.field === 'agendamento_id'));
  assert(validateAgendamentoIdRequest({ cliente_id: VALID_UUID, agendamento_id: 'invalid' }).some((e) => e.rule === 'uuid'));
  assertEquals(validateAgendamentoIdRequest({ cliente_id: VALID_UUID, agendamento_id: VALID_UUID }).length, 0);
});

Deno.test('validateAvailabilityRequest: body null → erro de tipo', () => {
  const errs = validateAvailabilityRequest(null);
  assert(errs.some((e) => e.rule === 'body_object'));
});

Deno.test('validateChatRequest: mensagem ok dentro do limite', () => {
  assertEquals(validateChatRequest({ cliente_id: VALID_UUID, mensagem: 'tem vaga?' }).length, 0);
});

Deno.test('validateChatRequest: mensagem >4000 chars → erro', () => {
  const errs = validateChatRequest({ cliente_id: VALID_UUID, mensagem: 'a'.repeat(4001) });
  assert(errs.some((e) => e.field === 'mensagem' && e.rule === 'max_length'));
});

Deno.test('validateChatRequest: historico não-array → erro', () => {
  assert(validateChatRequest({ cliente_id: VALID_UUID, historico: 'not-array' }).some((e) => e.rule === 'array'));
});

Deno.test('validateChatRequest: historico >50 itens → erro', () => {
  const errs = validateChatRequest({
    cliente_id: VALID_UUID,
    historico: Array(51).fill('msg'),
  });
  assert(errs.some((e) => e.rule === 'max_items'));
});

Deno.test('validateChatRequest: item de historico >2000 chars → erro', () => {
  const errs = validateChatRequest({
    cliente_id: VALID_UUID,
    historico: ['ok', 'a'.repeat(2001)],
  });
  assert(errs.some((e) => e.field === 'historico[1]' && e.rule === 'max_length'));
});

Deno.test('validateFilaRequest: observacoes >2000 chars → erro', () => {
  const errs = validateFilaRequest({ cliente_id: VALID_UUID, observacoes: 'x'.repeat(2001) });
  assert(errs.some((e) => e.field === 'observacoes' && e.rule === 'max_length'));
});

Deno.test('validateFilaRequest: paciente_nome não-string → erro', () => {
  assert(validateFilaRequest({ cliente_id: VALID_UUID, paciente_nome: 123 }).some((e) => e.rule === 'string'));
});

Deno.test('validatePatientSearchRequest: campos opcionais OK', () => {
  assertEquals(validatePatientSearchRequest({ cliente_id: VALID_UUID }).length, 0);
});

Deno.test('validatePatientSearchRequest: nome como array → erro', () => {
  assert(validatePatientSearchRequest({ cliente_id: VALID_UUID, nome: ['array'] }).some((e) => e.rule === 'string'));
});
