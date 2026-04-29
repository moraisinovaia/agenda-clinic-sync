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
  contemIntencaoExplicita,
  dispatchHandler,
  resolveHandlerMessage,
  planSchedulingTurn,
  OBRIGATORIOS_AGENDAR,
  type DadosColetados,
} from '../_handlers/chat.ts';

import { isBuscaProximaDisponibilidade, detectarDiaSemana } from '../_handlers/availability.ts';
import { calcularVagasDisponiveisComLimites } from '../_lib/limites.ts';

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

// ── contemIntencaoExplicita ───────────────────────────────────────────────

// Caso: "Oi, quero marcar consulta" não vira saudação genérica
Deno.test('contemIntencaoExplicita: saudação pura retorna false — override de saudação é aplicado', () => {
  assertFalse(contemIntencaoExplicita('Oi'),         '"Oi" é saudação pura');
  assertFalse(contemIntencaoExplicita('Olá'),        '"Olá" é saudação pura');
  assertFalse(contemIntencaoExplicita('Bom dia'),    '"Bom dia" é saudação pura');
  assertFalse(contemIntencaoExplicita('Boa tarde!'), '"Boa tarde!" é saudação pura');
  assertFalse(contemIntencaoExplicita('Oi tudo bem?'), '"Oi tudo bem?" sem intenção de scheduling');
});

Deno.test('contemIntencaoExplicita: saudação + intenção retorna true — override NÃO aplicado', () => {
  assert(contemIntencaoExplicita('Oi, quero marcar consulta'),            'marcar consulta = intenção explícita');
  assert(contemIntencaoExplicita('Olá, gostaria de agendar'),             'agendar = intenção explícita');
  assert(contemIntencaoExplicita('Bom dia, preciso cancelar meu retorno'),'cancelar = intenção explícita');
  assert(contemIntencaoExplicita('oi quero ver horario disponivel'),      'horario = intenção explícita');
  assert(contemIntencaoExplicita('Boa tarde, tem vaga para consulta?'),   'vaga + consulta = intenção explícita');
});

// ── dispatchHandler — auto-fill de médico e serviço ──────────────────────

// Caso: "quero agendar consulta" não pergunta médico nem serviço
Deno.test('dispatchHandler: check_availability com servico + medico auto-preenchidos → handler=availability', () => {
  const dados: DadosColetados = {
    ...dadosVazios(),
    servico:     'Consulta Cardiológica',  // auto-fill
    medico_nome: 'Dr. Marcelo',            // auto-fill
    medico_id:   'uuid-marcelo',
  };
  const dec = dispatchHandler('check_availability', 'disponibilidade', dados, { cliente_id: 'x' });
  assertEquals(dec.handler, 'availability', 'deve despachar para availability');
  assertNotEquals(dec.body, null);
  assertEquals((dec.body as Record<string, unknown>).atendimento_nome, 'Consulta Cardiológica');
  assertEquals((dec.body as Record<string, unknown>).medico_nome, 'Dr. Marcelo');
});

Deno.test('dispatchHandler: check_availability sem servico → handler=null (nunca deve ocorrer após auto-fill)', () => {
  const dados: DadosColetados = {
    ...dadosVazios(),
    medico_nome: 'Dr. Marcelo',  // medico ok, servico=null
  };
  const dec = dispatchHandler('check_availability', 'disponibilidade', dados, { cliente_id: 'x' });
  assertEquals(dec.handler, null, 'sem servico o dispatch falha — auto-fill deve ter prevenido isso');
});

// Caso: "dia 29/04" em verificando_disponibilidade não escala — dispatch funciona com servico auto-fill
Deno.test('dispatchHandler: com servico auto-fill e data_consulta nova, dispatch funciona normalmente', () => {
  const dados: DadosColetados = {
    ...dadosVazios(),
    servico:       'Consulta Cardiológica',  // auto-fill
    medico_nome:   'Dr. Marcelo',            // auto-fill
    medico_id:     'uuid-marcelo',
    data_consulta: '2026-04-29',             // "dia 29/04" extraído pelo LLM
  };
  const dec = dispatchHandler('check_availability', 'disponibilidade', dados, { cliente_id: 'x' });
  assertEquals(dec.handler, 'availability', 'com servico e data disponibiliza handler — loop detection não atingida');
  assertEquals((dec.body as Record<string, unknown>).data_consulta, '2026-04-29');
});

// missing_fields não inclui servico nem medico quando auto-preenchidos
Deno.test('computeMissingFields: servico e medico_nome auto-preenchidos não aparecem em missing', () => {
  const dados: DadosColetados = {
    ...dadosVazios(),
    servico:     'Consulta Cardiológica',
    medico_nome: 'Dr. Marcelo',
    // faltam: data_consulta, nome_paciente, data_nascimento, convenio
  };
  const missing = computeMissingFields('agendar', dados);
  assertFalse(missing.includes('servico'),     'servico auto-fill não deve estar em missing');
  assertFalse(missing.includes('medico_nome'), 'medico_nome auto-fill não deve estar em missing');
  assert(missing.includes('data_consulta'),    'data_consulta ainda está faltando');
  assert(missing.includes('nome_paciente'),    'nome_paciente ainda está faltando');
  assert(missing.includes('convenio'),         'convenio ainda está faltando');
});

// ── resolveHandlerMessage ─────────────────────────────────────────────────

// A) Quando handler retorna businessErrorResponse (sem message), usa mensagem_usuario
Deno.test('resolveHandlerMessage: businessErrorResponse usa mensagem_usuario quando não há message', () => {
  const hData = {
    success: false,
    codigo_erro: 'SEM_VAGAS_DISPONIVEIS',
    mensagem_usuario: '😔 Não encontrei vagas disponíveis para Dr. Marcelo.',
    mensagem_whatsapp: '😔 Não encontrei vagas disponíveis para Dr. Marcelo.',
    // sem campo message
  };
  const result = resolveHandlerMessage(hData, 'fallback genérico');
  assertStringIncludes(result, 'Não encontrei vagas', 'deve usar mensagem_usuario, não o fallback');
  assertFalse(result === 'fallback genérico', 'não deve cair no fallback LLM');
});

// E) Quando businessErrorResponse tem mensagem_whatsapp mas não mensagem_usuario
Deno.test('resolveHandlerMessage: prefere message > mensagem_whatsapp > mensagem_usuario > fallback', () => {
  assertEquals(
    resolveHandlerMessage({ message: 'A' }, 'fallback'),
    'A',
    'message tem prioridade máxima',
  );
  assertEquals(
    resolveHandlerMessage({ mensagem_whatsapp: 'B' }, 'fallback'),
    'B',
    'mensagem_whatsapp é segunda opção',
  );
  assertEquals(
    resolveHandlerMessage({ mensagem_usuario: 'C' }, 'fallback'),
    'C',
    'mensagem_usuario é terceira opção',
  );
  assertEquals(
    resolveHandlerMessage(null, 'fallback'),
    'fallback',
    'sem hData usa fallback',
  );
  assertEquals(
    resolveHandlerMessage({}, 'fallback'),
    'fallback',
    'hData vazio usa fallback',
  );
});

// ── dispatchHandler envia mensagem_original ───────────────────────────────

// B) mensagem_original chega no body de availability quando presente no baseBody
Deno.test('dispatchHandler: mensagem_original incluída no body de availability', () => {
  const dados: DadosColetados = {
    ...dadosVazios(),
    servico:     'Consulta Cardiológica',
    medico_nome: 'Dr. Marcelo',
  };
  const dec = dispatchHandler('check_availability', 'disponibilidade', dados, {
    cliente_id:        'x',
    mensagem_original: 'tem vaga pra quando?',
  });
  assertEquals(dec.handler, 'availability');
  assertEquals((dec.body as Record<string, unknown>).mensagem_original, 'tem vaga pra quando?');
});

// ── isBuscaProximaDisponibilidade ─────────────────────────────────────────

// C) Mensagens sem data específica → true (deve acionar busca de próximas datas)
Deno.test('isBuscaProximaDisponibilidade: detecta intenção de disponibilidade geral', () => {
  assert(isBuscaProximaDisponibilidade('tem vaga pra quando?'),         '"tem vaga pra quando?" = busca geral');
  assert(isBuscaProximaDisponibilidade('qual a próxima vaga?'),         '"próxima vaga" = busca geral');
  assert(isBuscaProximaDisponibilidade('quando tem consulta?'),         '"quando tem consulta" = busca geral');
  assert(isBuscaProximaDisponibilidade('tem horário disponível?'),      '"tem horário disponível" = busca geral');
  assert(isBuscaProximaDisponibilidade('tem vaga?'),                    '"tem vaga" = busca geral');
  assert(isBuscaProximaDisponibilidade('você não consegue ver quando tem vaga pra mim?'), 'frase completa do caso real');
});

// D) Mensagens com data específica → false (não deve ativar busca de próximas datas)
Deno.test('isBuscaProximaDisponibilidade: não detecta quando há data específica ou outra intenção', () => {
  assertFalse(isBuscaProximaDisponibilidade('quero para dia 20 de maio'),       'data específica');
  assertFalse(isBuscaProximaDisponibilidade('pode ser na quinta-feira'),        'dia da semana específico');
  assertFalse(isBuscaProximaDisponibilidade('pode agendar?'),                   'confirmação não é disponibilidade geral');
  assertFalse(isBuscaProximaDisponibilidade(null),                              'null retorna false');
  assertFalse(isBuscaProximaDisponibilidade(''),                                'vazio retorna false');
  assertFalse(isBuscaProximaDisponibilidade('ok'),                              '"ok" isolado não é busca geral');
});

// ── planSchedulingTurn ────────────────────────────────────────────────────

function mkExtraction(
  intent: string,
  resposta = '',
): { intent: string; provided_fields: string[]; resposta: string; next_action: string } {
  return { intent, provided_fields: [], resposta, next_action: 'ask_missing' };
}

function configComServico(nomeServico = 'Consulta Cardiológica'): DynamicConfig {
  return {
    clinic_info: null,
    business_rules: {
      doc1: {
        medico_id:   'uuid-marcelo',
        medico_nome: 'Dr. Marcelo',
        config: { servicos: { [nomeServico]: {} } } as any,
      },
    },
    mensagens: {},
    loadedAt: 0,
  };
}

// 1. intent não-scheduling → defer sem tocar dados
Deno.test('planSchedulingTurn: intent=humano → action=defer, preserva resposta do LLM', () => {
  const plan = planSchedulingTurn({
    estadoAtual: 'inicio',
    mensagem:    'quero falar com uma pessoa',
    extraction:  mkExtraction('humano', 'Vou transferir para atendente.'),
    dadosMerged: dadosVazios(),
    config:      null,
  });
  assertEquals(plan.action, 'defer');
  assertEquals(plan.resposta, 'Vou transferir para atendente.');
  assertEquals(plan.missing_fields.length, 0);
});

// 2. disponibilidade sem servico (e sem config para auto-fill) → ask_missing(servico)
Deno.test('planSchedulingTurn: disponibilidade sem servico → ask_missing, missing=[servico]', () => {
  const dados = { ...dadosVazios(), medico_nome: 'Dr. Marcelo' };
  const plan = planSchedulingTurn({
    estadoAtual: 'inicio',
    mensagem:    'tem horário disponível?',
    extraction:  mkExtraction('disponibilidade'),
    dadosMerged: dados,
    config:      null,
  });
  assertEquals(plan.action, 'ask_missing');
  assert(plan.missing_fields.includes('servico'), 'servico deve estar em missing_fields');
});

// 3. disponibilidade + "tem vaga pra quando?" → check_next_availability
Deno.test('planSchedulingTurn: disponibilidade + busca geral → check_next_availability', () => {
  const dados = { ...dadosVazios(), servico: 'Consulta Cardiológica', medico_nome: 'Dr. Marcelo' };
  const plan = planSchedulingTurn({
    estadoAtual: 'identificando_servico',
    mensagem:    'tem vaga pra quando?',
    extraction:  mkExtraction('disponibilidade'),
    dadosMerged: dados,
    config:      null,
  });
  assertEquals(plan.action, 'check_next_availability');
});

// 4. disponibilidade com data_consulta preenchida → check_availability_by_date
Deno.test('planSchedulingTurn: disponibilidade + data_consulta → check_availability_by_date', () => {
  const dados: DadosColetados = {
    ...dadosVazios(),
    servico:       'Consulta Cardiológica',
    medico_nome:   'Dr. Marcelo',
    data_consulta: '2026-05-10',
  };
  const plan = planSchedulingTurn({
    estadoAtual: 'identificando_servico',
    mensagem:    'quero para dia 10 de maio',
    extraction:  mkExtraction('disponibilidade'),
    dadosMerged: dados,
    config:      null,
  });
  assertEquals(plan.action, 'check_availability_by_date');
  assertEquals(plan.dados.data_consulta, '2026-05-10');
});

// 5. disponibilidade sem data e mensagem genérica → check_next_availability (padrão)
Deno.test('planSchedulingTurn: disponibilidade sem data e mensagem genérica → check_next_availability padrão', () => {
  const dados = { ...dadosVazios(), servico: 'Consulta Cardiológica', medico_nome: 'Dr. Marcelo' };
  const plan = planSchedulingTurn({
    estadoAtual: 'identificando_servico',
    mensagem:    'quero verificar disponibilidade',
    extraction:  mkExtraction('disponibilidade'),
    dadosMerged: dados,
    config:      null,
  });
  assertEquals(plan.action, 'check_next_availability');
});

// 6. agendar sem nenhum obrigatório → convenio pedido primeiro (OBRIGATORIOS_AGENDAR order)
Deno.test('planSchedulingTurn: agendar sem nenhum obrigatório → convenio é o primeiro campo pedido', () => {
  const dados: DadosColetados = {
    ...dadosVazios(),
    servico:     'Consulta Cardiológica',
    medico_nome: 'Dr. Marcelo',
  };
  const plan = planSchedulingTurn({
    estadoAtual: 'inicio',
    mensagem:    'quero marcar consulta',
    extraction:  mkExtraction('agendar'),
    dadosMerged: dados,
    config:      null,
  });
  assertEquals(plan.action, 'ask_missing');
  assertEquals(plan.missing_fields[0], 'convenio', 'OBRIGATORIOS_AGENDAR: convenio deve ser pedido primeiro');
  assertEquals(plan.missing_fields.length, 3, 'todos os 3 obrigatórios devem estar em missing_fields');
});

// 7. agendar com todos os obrigatórios mas sem confirmação → confirm_schedule
Deno.test('planSchedulingTurn: agendar com todos obrigatórios + confirmado=null → confirm_schedule', () => {
  const dados: DadosColetados = {
    ...dadosVazios(),
    servico:       'Consulta Cardiológica',
    medico_nome:   'Dr. Marcelo',
    convenio:      'UNIMED 20%',
    data_consulta: '2026-05-10',
    nome_paciente: 'João Silva',
  };
  const plan = planSchedulingTurn({
    estadoAtual: 'coletando_dados',
    mensagem:    'quero marcar',
    extraction:  mkExtraction('agendar', 'Vou confirmar: Consulta dia 10/05 com UNIMED 20%...'),
    dadosMerged: dados,
    config:      null,
  });
  assertEquals(plan.action, 'confirm_schedule');
  assertEquals(plan.missing_fields.length, 0);
});

// 8. agendar com todos os obrigatórios + confirmado=true → schedule
Deno.test('planSchedulingTurn: agendar com todos obrigatórios + confirmado=true → schedule', () => {
  const dados: DadosColetados = {
    ...dadosVazios(),
    servico:       'Consulta Cardiológica',
    medico_nome:   'Dr. Marcelo',
    convenio:      'UNIMED 20%',
    data_consulta: '2026-05-10',
    nome_paciente: 'João Silva',
    confirmado:    true,
  };
  const plan = planSchedulingTurn({
    estadoAtual: 'confirmando_dados',
    mensagem:    'sim confirmo',
    extraction:  mkExtraction('agendar'),
    dadosMerged: dados,
    config:      null,
  });
  assertEquals(plan.action, 'schedule');
  assertEquals(plan.missing_fields.length, 0);
});

// 9. auto-fill de servico: config com 1 médico + 1 serviço → servico preenchido → não ask_missing
Deno.test('planSchedulingTurn: disponibilidade + config 1 médico 1 serviço → auto-fill servico → check_next', () => {
  const dados = { ...dadosVazios(), medico_nome: 'Dr. Marcelo' };
  const plan = planSchedulingTurn({
    estadoAtual: 'identificando_servico',
    mensagem:    'tem vaga pra quando?',
    extraction:  mkExtraction('disponibilidade'),
    dadosMerged: dados,
    config:      configComServico('Consulta Cardiológica'),
  });
  assertEquals(plan.action, 'check_next_availability', 'auto-fill de servico deve evitar ask_missing');
  assertEquals(dados.servico, 'Consulta Cardiológica', 'autoFillServicoPlan deve preencher dados.servico');
});

// OBRIGATORIOS_AGENDAR exportado tem ordem correta (convenio primeiro)
Deno.test('OBRIGATORIOS_AGENDAR: convenio é o primeiro campo, contém os 3 obrigatórios', () => {
  assertEquals(OBRIGATORIOS_AGENDAR.length, 3);
  assertEquals(OBRIGATORIOS_AGENDAR[0], 'convenio',      'primeiro campo deve ser convenio');
  assertEquals(OBRIGATORIOS_AGENDAR[1], 'data_consulta', 'segundo campo deve ser data_consulta');
  assertEquals(OBRIGATORIOS_AGENDAR[2], 'nome_paciente', 'terceiro campo deve ser nome_paciente');
});

// ── detectarDiaSemana — Bug 1: sem falsos positivos por substrings ─────────

Deno.test('detectarDiaSemana: "quando tem horário?" NÃO deve inferir quarta (qua ⊂ quando)', () => {
  assertEquals(detectarDiaSemana('quando tem horário?'), null);
});

Deno.test('detectarDiaSemana: "qualquer dia" NÃO deve inferir quarta (qua ⊂ qualquer)', () => {
  assertEquals(detectarDiaSemana('qualquer dia'), null);
});

Deno.test('detectarDiaSemana: "temos horário?" NÃO deve inferir terça (ter ⊂ temos)', () => {
  assertEquals(detectarDiaSemana('temos horário?'), null);
});

Deno.test('detectarDiaSemana: "seguinte semana" NÃO deve inferir segunda (seg ⊂ seguinte)', () => {
  assertEquals(detectarDiaSemana('seguinte semana'), null);
});

Deno.test('detectarDiaSemana: "quinto andar" NÃO deve inferir quinta (qui ⊂ quinto)', () => {
  assertEquals(detectarDiaSemana('quinto andar'), null);
});

Deno.test('detectarDiaSemana: "sexo masculino" NÃO deve inferir sexta (sex ⊂ sexo)', () => {
  assertEquals(detectarDiaSemana('sexo masculino'), null);
});

Deno.test('detectarDiaSemana: detecta "quarta-feira" corretamente (dia 3)', () => {
  assertEquals(detectarDiaSemana('tem vaga na quarta-feira?'), 3);
  assertEquals(detectarDiaSemana('quarta'), 3);
  assertEquals(detectarDiaSemana('na quarta'), 3);
});

Deno.test('detectarDiaSemana: detecta "segunda" e variantes (dia 1)', () => {
  assertEquals(detectarDiaSemana('pode ser segunda?'), 1);
  assertEquals(detectarDiaSemana('segunda-feira'), 1);
  assertEquals(detectarDiaSemana('na segunda feira'), 1);
});

Deno.test('detectarDiaSemana: detecta "terça" e variantes sem falso positivo (dia 2)', () => {
  assertEquals(detectarDiaSemana('tem vaga na terça?'), 2);
  assertEquals(detectarDiaSemana('terça-feira'), 2);
  // palavras com "ter" internas não devem ser detectadas
  assertEquals(detectarDiaSemana('terceiro andar'), null);
  assertEquals(detectarDiaSemana('internet ok'), null);
});

Deno.test('detectarDiaSemana: detecta "quinta" e variantes (dia 4)', () => {
  assertEquals(detectarDiaSemana('pode ser quinta?'), 4);
  assertEquals(detectarDiaSemana('quinta-feira'), 4);
});

Deno.test('detectarDiaSemana: detecta "sexta" e variantes (dia 5)', () => {
  assertEquals(detectarDiaSemana('prefiro sexta'), 5);
  assertEquals(detectarDiaSemana('sexta-feira'), 5);
});

Deno.test('detectarDiaSemana: null e string vazia retornam null', () => {
  assertEquals(detectarDiaSemana(null), null);
  assertEquals(detectarDiaSemana(''), null);
  assertEquals(detectarDiaSemana(undefined), null);
});

// ── calcularVagasDisponiveisComLimites — Bug 2: nunca retorna Infinity ─────

// Mock de supabase que retorna count=0 (sem agendamentos)
function mockSupabase(count = 0) {
  const chain: Record<string, unknown> = {};
  const methods = ['select','eq','in','is','ilike','gte','lt','neq','not','maybeSingle'];
  for (const m of methods) {
    chain[m] = () => chain;
  }
  // Torna a chain thenable (await-able) retornando { data: [], count, error: null }
  chain['then'] = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve({ data: [], count, error: null }));
  return { from: () => chain };
}

Deno.test('calcularVagasDisponiveisComLimites: serviço com compartilha_limite_com mas sem periodos retorna número finito', async () => {
  const supabase = mockSupabase(0);
  const servicoConfig = { compartilha_limite_com: 'consulta' }; // sem limite próprio, sem periodos
  const regras = {}; // sem periodos no nível raiz

  const resultado = await calcularVagasDisponiveisComLimites(
    supabase, 'cliente-x', 'medico-x', '2026-05-07',
    'retorno', servicoConfig, regras,
  );

  assert(Number.isFinite(resultado),  'resultado deve ser finito, não Infinity');
  assert(!isNaN(resultado),           'resultado não deve ser NaN');
  assert(resultado >= 0,              'resultado deve ser >= 0');
});

Deno.test('calcularVagasDisponiveisComLimites: serviço com limite direto usa-o como vagasPool quando pool não encontrado', async () => {
  const supabase = mockSupabase(0); // 0 agendamentos existentes
  const servicoConfig = {
    compartilha_limite_com: 'consulta',
    limite: 5, // limite direto do serviço
  };
  const regras = { periodos: {} }; // periodos vazio → pool não encontrado

  const resultado = await calcularVagasDisponiveisComLimites(
    supabase, 'cliente-x', 'medico-x', '2026-05-07',
    'retorno', servicoConfig, regras,
  );

  assertEquals(resultado, 5, 'deve usar cfg.limite=5 quando pool não encontrado');
});

Deno.test('calcularVagasDisponiveisComLimites: sem limites e sem cfg.limite → fallback conservador 0 (evita overbooking)', async () => {
  const supabase = mockSupabase(0);
  const servicoConfig = {}; // sem compartilha_limite_com, sem limite_proprio, sem limite
  const regras = {};

  const resultado = await calcularVagasDisponiveisComLimites(
    supabase, 'cliente-x', 'medico-x', '2026-05-07',
    'retorno', servicoConfig, regras,
  );

  assert(Number.isFinite(resultado), 'sem limites configurados deve retornar finito, não Infinity');
  assertEquals(resultado, 0, 'sem cfg.limite o fallback deve ser 0 (conservador, evita overbooking invisível)');
});

Deno.test('calcularVagasDisponiveisComLimites: sem pool/sublimite mas com cfg.limite → usa cfg.limite como capacidade', async () => {
  const supabase = mockSupabase(0);
  const servicoConfig = { limite: 8 }; // só cfg.limite, sem compartilha/sublimite
  const regras = {};

  const resultado = await calcularVagasDisponiveisComLimites(
    supabase, 'cliente-x', 'medico-x', '2026-05-07',
    'retorno', servicoConfig, regras,
  );

  assertEquals(resultado, 8, 'cfg.limite=8 deve ser usado quando não há pool nem sublimite');
});
