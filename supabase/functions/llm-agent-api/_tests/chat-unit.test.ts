// Testes unitários das funções puras de regra de negócio do chat handler.
// Executar com: deno test supabase/functions/llm-agent-api/_tests/chat-unit.test.ts
//
// Não dependem de banco, OpenAI ou rede — cobrem apenas a lógica determinística.

import {
  assertEquals,
  assertFalse,
  assert,
  assertNotEquals,
  assertStringIncludes,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  auditRules,
  mergeDados,
  computeMissingFields,
  isServicoTergo,
  isServicoMapa,
  isConvenioParceiro,
  finalizeResponse,
  OBRIGATORIOS_CONSULTA,
  type DadosColetados,
} from '../_handlers/chat.ts';

import type { DynamicConfig } from '../_lib/types.ts';

// ── Helpers ───────────────────────────────────────────────────────────────

function dadosVazios(): DadosColetados {
  return {
    servico: null, medico_nome: null, medico_id: null,
    data_consulta: null, periodo: null, convenio: null,
    nome_paciente: null, data_nascimento: null, confirmado: null,
    tem_guia: null, fistula: null, peso: null,
  };
}

// ── isServicoMapa ─────────────────────────────────────────────────────────

Deno.test('isServicoMapa: reconhece variantes de MAPA', () => {
  assertEquals(isServicoMapa('MAPA 24H'), true);
  assertEquals(isServicoMapa('mapa'), true);
  assertEquals(isServicoMapa('Mapa 24h'), true);
  assertEquals(isServicoMapa('teste ergométrico'), false);
  assertEquals(isServicoMapa(null), false);
});

// ── isServicoTergo ────────────────────────────────────────────────────────

Deno.test('isServicoTergo: reconhece variantes de Teste Ergométrico', () => {
  assertEquals(isServicoTergo('Teste Ergométrico'), true);
  assertEquals(isServicoTergo('teste ergometrico'), true);
  assertEquals(isServicoTergo('ERGOMÉTRICO'), true);
  assertEquals(isServicoTergo('MAPA 24H'), false);
  assertEquals(isServicoTergo(null), false);
});

// ── isConvenioParceiro ────────────────────────────────────────────────────

Deno.test('isConvenioParceiro: identifica parceiros corretamente', () => {
  assertEquals(isConvenioParceiro('MEDPREV'), true);
  assertEquals(isConvenioParceiro('medprev'), true);
  assertEquals(isConvenioParceiro('MEDCLIN'), true);
  assertEquals(isConvenioParceiro('SEDILAB'), true);
  assertEquals(isConvenioParceiro('CLINICA VIDA'), true);
  assertEquals(isConvenioParceiro('CLINCENTER'), true);
  assertEquals(isConvenioParceiro('SERTAO SAUDE'), true);
  // Convênios normais não são parceiros
  assertEquals(isConvenioParceiro('UNIMED'), false);
  assertEquals(isConvenioParceiro('PARTICULAR'), false);
  assertEquals(isConvenioParceiro('HGU'), false);
  assertEquals(isConvenioParceiro(null), false);
});

// ── mergeDados ────────────────────────────────────────────────────────────

Deno.test('mergeDados: preserva valores anteriores quando LLM retorna null', () => {
  const anterior = { servico: 'MAPA 24H', convenio: 'UNIMED 20%' };
  const extraido = { ...dadosVazios(), nome_paciente: 'João Silva' };
  const merged = mergeDados(anterior, extraido);
  assertEquals(merged.servico, 'MAPA 24H');          // preservado
  assertEquals(merged.convenio, 'UNIMED 20%');        // preservado
  assertEquals(merged.nome_paciente, 'João Silva');   // novo valor
});

Deno.test('mergeDados: sobrescreve valores anteriores quando LLM retorna não-null', () => {
  const anterior = { servico: 'MAPA 24H' };
  const extraido = { ...dadosVazios(), servico: 'Teste Ergométrico' };
  const merged = mergeDados(anterior, extraido);
  assertEquals(merged.servico, 'Teste Ergométrico');
});

Deno.test('mergeDados: lida com dados_extraidos nulos graciosamente', () => {
  const anterior = { servico: 'MAPA 24H', peso: 80 };
  const merged = mergeDados(anterior, null);
  assertEquals(merged.servico, 'MAPA 24H');
  assertEquals(merged.peso, 80);
});

// ── auditRules — MAPA sem guia ────────────────────────────────────────────

Deno.test('auditRules: MAPA sem guia bloqueia em intent=disponibilidade', () => {
  const dados = { ...dadosVazios(), servico: 'MAPA 24H' };
  const result = auditRules(dados, 'disponibilidade', 'check_availability');
  assertEquals(result.blocked, true);
  assertEquals(result.reason, 'MAPA_SEM_GUIA');
});

Deno.test('auditRules: MAPA sem guia bloqueia em intent=agendar', () => {
  const dados = { ...dadosVazios(), servico: 'MAPA 24H' };
  const result = auditRules(dados, 'agendar', 'confirm_schedule');
  assertEquals(result.blocked, true);
  assertEquals(result.reason, 'MAPA_SEM_GUIA');
});

Deno.test('auditRules: MAPA COM guia libera fluxo', () => {
  const dados = { ...dadosVazios(), servico: 'MAPA 24H', tem_guia: true };
  const result = auditRules(dados, 'agendar', 'confirm_schedule');
  assertFalse(result.blocked);
});

Deno.test('auditRules: MAPA sem guia NÃO bloqueia intent=convenio (apenas informa)', () => {
  const dados = { ...dadosVazios(), servico: 'MAPA 24H' };
  const result = auditRules(dados, 'convenio', 'answer_info');
  assertFalse(result.blocked);
});

// ── auditRules — Teste Ergométrico ────────────────────────────────────────

Deno.test('auditRules: Ergométrico com fístula bloqueia', () => {
  const dados = { ...dadosVazios(), servico: 'Teste Ergométrico', fistula: true };
  const result = auditRules(dados, 'agendar', 'confirm_schedule');
  assertEquals(result.blocked, true);
  assertEquals(result.reason, 'FISTULA_BLOCK');
});

Deno.test('auditRules: Ergométrico sem fístula não bloqueia por fístula', () => {
  const dados = { ...dadosVazios(), servico: 'Teste Ergométrico', fistula: false, peso: 80 };
  const result = auditRules(dados, 'agendar', 'confirm_schedule');
  assertFalse(result.blocked);
});

Deno.test('auditRules: Ergométrico peso > 150kg bloqueia', () => {
  const dados = { ...dadosVazios(), servico: 'Teste Ergométrico', peso: 160, fistula: false };
  const result = auditRules(dados, 'disponibilidade', 'check_availability');
  assertEquals(result.blocked, true);
  assertEquals(result.reason, 'PESO_BLOCK');
});

Deno.test('auditRules: Ergométrico peso exatamente 150kg não bloqueia', () => {
  const dados = { ...dadosVazios(), servico: 'Teste Ergométrico', peso: 150, fistula: false };
  const result = auditRules(dados, 'agendar', 'execute_schedule');
  assertFalse(result.blocked);
});

Deno.test('auditRules: Ergométrico peso 80kg libera', () => {
  const dados = { ...dadosVazios(), servico: 'Teste Ergométrico', peso: 80, fistula: false };
  const result = auditRules(dados, 'agendar', 'execute_schedule');
  assertFalse(result.blocked);
});

// ── auditRules — Convênio Parceiro ────────────────────────────────────────

Deno.test('auditRules: MEDPREV bloqueia agendamento', () => {
  const dados = { ...dadosVazios(), convenio: 'MEDPREV', servico: 'Consulta' };
  const result = auditRules(dados, 'agendar', 'confirm_schedule');
  assertEquals(result.blocked, true);
  assertEquals(result.reason, 'CONVENIO_PARCEIRO');
});

Deno.test('auditRules: UNIMED não bloqueia', () => {
  const dados = { ...dadosVazios(), convenio: 'UNIMED 20%', servico: 'Consulta' };
  const result = auditRules(dados, 'agendar', 'confirm_schedule');
  assertFalse(result.blocked);
});

// ── computeMissingFields ──────────────────────────────────────────────────

Deno.test('computeMissingFields: agendar sem dados → todos os campos obrigatórios faltam', () => {
  const missing = computeMissingFields('agendar', dadosVazios());
  ['servico', 'medico_nome', 'data_consulta', 'nome_paciente', 'data_nascimento', 'convenio']
    .forEach((f) => assertEquals(missing.includes(f), true, `campo "${f}" deveria estar em missing`));
});

Deno.test('computeMissingFields: MAPA adiciona tem_guia à lista quando não confirmado', () => {
  const dados = { ...dadosVazios(), servico: 'MAPA 24H' };
  const missing = computeMissingFields('agendar', dados);
  assertEquals(missing.includes('tem_guia'), true);
});

Deno.test('computeMissingFields: MAPA com guia confirmada não adiciona tem_guia', () => {
  const dados = {
    ...dadosVazios(),
    servico: 'MAPA 24H', tem_guia: true,
    medico_nome: 'Dr. Marcelo', data_consulta: '2026-05-10',
    nome_paciente: 'Ana Lima', data_nascimento: '1980-03-20', convenio: 'UNIMED',
  };
  const missing = computeMissingFields('agendar', dados);
  assertFalse(missing.includes('tem_guia'));
});

Deno.test('computeMissingFields: Ergométrico em disponibilidade exige peso e fístula', () => {
  const dados = { ...dadosVazios(), servico: 'Teste Ergométrico', medico_nome: 'Dr. Marcelo' };
  const missing = computeMissingFields('disponibilidade', dados);
  assertEquals(missing.includes('peso'), true, '"peso" deveria estar em missing');
  assertEquals(missing.includes('fistula'), true, '"fistula" deveria estar em missing');
});

Deno.test('computeMissingFields: Ergométrico com peso e fístula informados não exige mais', () => {
  const dados = {
    ...dadosVazios(),
    servico: 'Teste Ergométrico', medico_nome: 'Dr. Marcelo',
    peso: 80, fistula: false,
  };
  const missing = computeMissingFields('disponibilidade', dados);
  assertFalse(missing.includes('peso'));
  assertFalse(missing.includes('fistula'));
});

Deno.test('computeMissingFields: Ergométrico com fistula=false (não nulo) não exige fistula', () => {
  const dados = { ...dadosVazios(), servico: 'Teste Ergométrico', fistula: false };
  const missing = computeMissingFields('agendar', dados);
  assertFalse(missing.includes('fistula'));
});

Deno.test('computeMissingFields: info_geral não exige nenhum campo', () => {
  const missing = computeMissingFields('info_geral', dadosVazios());
  assertEquals(missing.length, 0);
});

Deno.test('computeMissingFields: cancelar exige apenas nome e nascimento', () => {
  const missing = computeMissingFields('cancelar', dadosVazios());
  assertEquals(missing.includes('nome_paciente'), true);
  assertEquals(missing.includes('data_nascimento'), true);
  assertFalse(missing.includes('servico'));
  assertFalse(missing.includes('convenio'));
});

// ── Helpers para finalizeResponse ────────────────────────────────────────

function captureWarns(): { warns: string[]; restore: () => void } {
  const warns: string[] = [];
  const orig = console.warn;
  console.warn = (...a: unknown[]) => warns.push(String(a[0]));
  return { warns, restore: () => { console.warn = orig; } };
}

function configUmMedico(nome = 'Dr. Marcelo', id = 'uuid-marcelo'): DynamicConfig {
  return {
    clinic_info: null,
    business_rules: { doc1: { medico_id: id, medico_nome: nome, config: null } },
    mensagens: {},
    loadedAt: 0,
  };
}

// ── finalizeResponse ──────────────────────────────────────────────────────

// Caso 1: respostaFinal="" → fallback humano + escalonado_humano + console.warn
Deno.test('finalizeResponse: resposta vazia → fallback humano, escalonado_humano e warn', () => {
  const { warns, restore } = captureWarns();

  const result = finalizeResponse({
    respostaFinal: '',
    dadosMerged: dadosVazios(),
    missingFields: [],
    novoEstado: 'identificando_servico',
    config: null,
    intent: 'outro',
  });

  restore();

  assertNotEquals(result.respostaFinal, '');
  assert(result.respostaFinal.trim().length > 0, 'resposta não pode ser vazia');
  assertEquals(result.novoEstado, 'escalonado_humano');
  assert(
    warns.some((w) => w.includes('resposta vazia')),
    'console.warn "resposta vazia" esperado',
  );
});

// Caso 2: intent=agendar, missing_fields=[], data_consulta=null → corrigir
Deno.test('finalizeResponse: agendar + missing_fields=[] + data_consulta null → corrige estado e pergunta', () => {
  const dados: DadosColetados = {
    ...dadosVazios(),
    medico_nome: 'Dr. Marcelo',
    nome_paciente: 'Ana Lima',
    convenio: 'UNIMED 20%',
    // data_consulta permanece null
  };
  const { warns, restore } = captureWarns();

  const result = finalizeResponse({
    respostaFinal: 'Confirmando seu agendamento...',
    dadosMerged: dados,
    missingFields: [],          // computeMissingFields retornou [] incorretamente
    novoEstado: 'agendado',     // estado errado — seria mudado para coletando_dados
    config: null,
    intent: 'agendar',
  });

  restore();

  assert(result.missingFields.includes('data_consulta'), 'data_consulta deve entrar em missing_fields');
  assertEquals(result.novoEstado, 'coletando_dados', 'estado deve recuar para coletando_dados');
  assertStringIncludes(
    result.respostaFinal.toLowerCase(),
    'data',
    'resposta deve perguntar pela data',
  );
  assert(
    warns.some((w) => w.includes('missing_fields')),
    'console.warn sobre missing_fields esperado',
  );
});

// Caso 3: médico único em config, medico_nome=null → auto-fill + remove de missing_fields
Deno.test('finalizeResponse: médico único → preenche medico_nome/id e remove de missing_fields', () => {
  const dados = dadosVazios();   // medico_nome = null
  const { warns, restore } = captureWarns();

  const result = finalizeResponse({
    respostaFinal: 'Como posso ajudar?',
    dadosMerged: dados,
    missingFields: ['medico_nome', 'data_consulta'],
    novoEstado: 'identificando_servico',
    config: configUmMedico(),
    intent: 'agendar',
  });

  restore();

  assertEquals(dados.medico_nome, 'Dr. Marcelo',     'medico_nome deve ser preenchido no objeto');
  assertEquals(dados.medico_id,   'uuid-marcelo',    'medico_id deve ser preenchido no objeto');
  assertFalse(
    result.missingFields.includes('medico_nome'),
    'medico_nome não deve aparecer em missing_fields após auto-fill',
  );
  assert(result.missingFields.includes('data_consulta'), 'data_consulta deve permanecer em missing_fields');
  assert(
    warns.some((w) => w.includes('médico único')),
    'console.warn de médico único esperado',
  );
});

// Caso 4: novo_estado=escalonado_humano + respostaFinal="" → mantém estado, aplica fallback
Deno.test('finalizeResponse: escalonado_humano + resposta vazia → mantém estado e fallback', () => {
  const result = finalizeResponse({
    respostaFinal: '',
    dadosMerged: dadosVazios(),
    missingFields: [],
    novoEstado: 'escalonado_humano',
    config: null,
    intent: 'humano',
  });

  assertEquals(result.novoEstado, 'escalonado_humano', 'estado escalonado_humano deve ser preservado');
  assertNotEquals(result.respostaFinal, '');
  assert(result.respostaFinal.trim().length > 0, 'fallback deve ser aplicado');
});

// Caso 5: histórico recebe a resposta final normalizada, não a vazia original
Deno.test('finalizeResponse: resposta retornada é a que vai para o histórico — não a original vazia', () => {
  const result = finalizeResponse({
    respostaFinal: '',           // vazia — deve ser substituída
    dadosMerged: dadosVazios(),
    missingFields: [],
    novoEstado: 'inicio',
    config: null,
    intent: 'outro',
  });

  // Simula exatamente como handleChat constrói historicoAtualizado após finalizeResponse:
  //   const historicoAtualizado = [...historico, { role:'assistant', content: respostaFinal }]
  // respostaFinal aqui é o valor RETORNADO por finalizeResponse, não o original.
  const historicoAtualizado = [
    { role: 'user',      content: 'olá' },
    { role: 'assistant', content: result.respostaFinal },
  ];

  assertNotEquals(historicoAtualizado[1].content, '',  'histórico não deve gravar resposta vazia');
  assert(
    historicoAtualizado[1].content.trim().length > 0,
    'histórico deve conter a resposta fallback, não string vazia',
  );
});

// Caso extra: OBRIGATORIOS_CONSULTA exportado contém exatamente os 3 campos do domínio
Deno.test('OBRIGATORIOS_CONSULTA: contém exatamente nome_paciente, data_consulta e convenio', () => {
  assertEquals(OBRIGATORIOS_CONSULTA.length, 3);
  assert(OBRIGATORIOS_CONSULTA.includes('nome_paciente'));
  assert(OBRIGATORIOS_CONSULTA.includes('data_consulta'));
  assert(OBRIGATORIOS_CONSULTA.includes('convenio'));
  assertFalse((OBRIGATORIOS_CONSULTA as string[]).includes('medico_nome'), 'medico_nome não é campo do paciente');
  assertFalse((OBRIGATORIOS_CONSULTA as string[]).includes('data_nascimento'), 'data_nascimento não é obrigatório');
});
