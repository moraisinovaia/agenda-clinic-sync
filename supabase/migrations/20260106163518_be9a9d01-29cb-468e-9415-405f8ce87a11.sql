
-- =====================================================
-- CADASTRO COMPLETO: 5 Profissionais ENDOGASTRO
-- Cliente ID: 39e120b4-5fb7-4d6f-9f91-a598a5bbd253
-- =====================================================

-- =====================================================
-- 1. CRIAR ATENDIMENTOS
-- =====================================================

-- Dra. Vaníria Brandão (Nutricionista) - d5a0950a-e7c6-46e1-be98-455ac59b2f10
INSERT INTO atendimentos (cliente_id, medico_id, nome, tipo, valor_particular, ativo)
SELECT '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'd5a0950a-e7c6-46e1-be98-455ac59b2f10', 'Consulta Nutricional', 'consulta', 350.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM atendimentos 
  WHERE medico_id = 'd5a0950a-e7c6-46e1-be98-455ac59b2f10' 
  AND nome = 'Consulta Nutricional'
);

-- Dr. Carlos Philliph (Oftalmologista) - 3e3489cf-9da8-408a-89c1-6cef5c950297
INSERT INTO atendimentos (cliente_id, medico_id, nome, tipo, valor_particular, ativo)
SELECT '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '3e3489cf-9da8-408a-89c1-6cef5c950297', 'Consulta Oftalmológica', 'consulta', 230.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM atendimentos 
  WHERE medico_id = '3e3489cf-9da8-408a-89c1-6cef5c950297' 
  AND nome = 'Consulta Oftalmológica'
);

INSERT INTO atendimentos (cliente_id, medico_id, nome, tipo, valor_particular, ativo)
SELECT '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '3e3489cf-9da8-408a-89c1-6cef5c950297', 'Mapeamento de Retina', 'exame', 150.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM atendimentos 
  WHERE medico_id = '3e3489cf-9da8-408a-89c1-6cef5c950297' 
  AND nome = 'Mapeamento de Retina'
);

-- Dra. Camila Helena (Psicóloga) - c5258941-9bf8-4f29-88cb-dd9077f78088
INSERT INTO atendimentos (cliente_id, medico_id, nome, tipo, valor_particular, ativo)
SELECT '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'c5258941-9bf8-4f29-88cb-dd9077f78088', 'Consulta Psicológica', 'consulta', 350.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM atendimentos 
  WHERE medico_id = 'c5258941-9bf8-4f29-88cb-dd9077f78088' 
  AND nome = 'Consulta Psicológica'
);

INSERT INTO atendimentos (cliente_id, medico_id, nome, tipo, valor_particular, ativo)
SELECT '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'c5258941-9bf8-4f29-88cb-dd9077f78088', 'Sessão Psicológica', 'consulta', 250.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM atendimentos 
  WHERE medico_id = 'c5258941-9bf8-4f29-88cb-dd9077f78088' 
  AND nome = 'Sessão Psicológica'
);

INSERT INTO atendimentos (cliente_id, medico_id, nome, tipo, valor_particular, ativo)
SELECT '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'c5258941-9bf8-4f29-88cb-dd9077f78088', 'Pacote 10 Sessões', 'consulta', 2000.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM atendimentos 
  WHERE medico_id = 'c5258941-9bf8-4f29-88cb-dd9077f78088' 
  AND nome = 'Pacote 10 Sessões'
);

-- Dr. Darcy Muritiba (Proctologista) - 8f59fe17-4bf9-4134-b7aa-626249966776
INSERT INTO atendimentos (cliente_id, medico_id, nome, tipo, valor_particular, ativo)
SELECT '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '8f59fe17-4bf9-4134-b7aa-626249966776', 'Consulta Proctológica', 'consulta', 500.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM atendimentos 
  WHERE medico_id = '8f59fe17-4bf9-4134-b7aa-626249966776' 
  AND nome = 'Consulta Proctológica'
);

INSERT INTO atendimentos (cliente_id, medico_id, nome, tipo, valor_particular, ativo)
SELECT '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '8f59fe17-4bf9-4134-b7aa-626249966776', 'Colonoscopia', 'procedimento', NULL, true
WHERE NOT EXISTS (
  SELECT 1 FROM atendimentos 
  WHERE medico_id = '8f59fe17-4bf9-4134-b7aa-626249966776' 
  AND nome = 'Colonoscopia'
);

-- Dr. Pedro Francisco (USG) - 4be6af8b-1f81-4fa2-8264-90400fbafff7
INSERT INTO atendimentos (cliente_id, medico_id, nome, tipo, valor_particular, ativo)
SELECT '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '4be6af8b-1f81-4fa2-8264-90400fbafff7', 'Ultrassonografia', 'exame', NULL, true
WHERE NOT EXISTS (
  SELECT 1 FROM atendimentos 
  WHERE medico_id = '4be6af8b-1f81-4fa2-8264-90400fbafff7' 
  AND nome = 'Ultrassonografia'
);

-- =====================================================
-- 2. ATUALIZAR BUSINESS RULES
-- =====================================================

-- Dra. Vaníria Brandão (Nutricionista)
UPDATE business_rules
SET config = jsonb_build_object(
  'convenios', jsonb_build_array('Medprev', 'AgendaVale', 'Mineração', 'Codevasf', 'Postal', 'Fusex', 'Particular'),
  'idade_minima', 0,
  'valor_particular', 350.00,
  'forma_pagamento', 'somente espécie',
  'servicos', jsonb_build_object(
    'consulta_nutricional', jsonb_build_object(
      'nome', 'Consulta Nutricional',
      'valor', 350.00,
      'ativo', true
    )
  ),
  'horarios', jsonb_build_object(
    'terca', jsonb_build_object(
      'ativo', true,
      'inicio', '14:00',
      'fim', '18:00',
      'pacientes', 5,
      'ficha_inicio', '13:30',
      'ficha_fim', '15:00'
    ),
    'sexta', jsonb_build_object(
      'ativo', true,
      'inicio', '14:00',
      'fim', '18:00',
      'pacientes', 5,
      'ficha_inicio', '13:30',
      'ficha_fim', '15:00'
    )
  ),
  'regras_especiais', jsonb_build_object(
    'mineracao_limite_diario', 1,
    'sem_retorno', jsonb_build_array('Medprev', 'AgendaVale'),
    'requer_guia_autorizacao', jsonb_build_array('Codevasf', 'Postal'),
    'requer_guia_autorizada_validade', jsonb_build_array('Fusex')
  ),
  'mensagens', jsonb_build_object(
    'codevasf_postal', 'Para Codevasf e Postal: precisa de guia e relatório médico para pegar autorização. Enviar documentos para autorizar.',
    'fusex', 'Para Fusex: a guia precisa vir autorizada e com validade.',
    'mineracao', 'Mineração: limite de 1 paciente por dia.',
    'pagamento', 'Valor da consulta: R$ 350,00 somente em espécie.'
  )
)
WHERE medico_id = 'd5a0950a-e7c6-46e1-be98-455ac59b2f10';

-- Dr. Carlos Philliph (Oftalmologista)
UPDATE business_rules
SET config = jsonb_build_object(
  'convenios', jsonb_build_array('Medprev', 'AgendaVale', 'Óticas/SEMARY PREV', 'Particular'),
  'idade_minima', 5,
  'valor_particular', 230.00,
  'forma_pagamento', 'espécie ou PIX',
  'servicos', jsonb_build_object(
    'consulta_oftalmologica', jsonb_build_object(
      'nome', 'Consulta Oftalmológica',
      'valor', 230.00,
      'ativo', true
    ),
    'mapeamento_retina', jsonb_build_object(
      'nome', 'Mapeamento de Retina',
      'valor', 150.00,
      'ativo', true
    )
  ),
  'horarios', jsonb_build_object(
    'terca', jsonb_build_object(
      'ativo', true,
      'grupos', jsonb_build_array(
        jsonb_build_object('horario', '14:00', 'pacientes', 4, 'ficha_antes', 30, 'ficha_fim', '15:00'),
        jsonb_build_object('horario', '15:00', 'pacientes', 4, 'ficha_antes', 15, 'ficha_fim', '16:00')
      )
    ),
    'quinta', jsonb_build_object(
      'ativo', true,
      'grupos', jsonb_build_array(
        jsonb_build_object('horario', '14:00', 'pacientes', 4, 'ficha_antes', 30, 'ficha_fim', '15:00'),
        jsonb_build_object('horario', '15:00', 'pacientes', 4, 'ficha_antes', 15, 'ficha_fim', '16:00')
      )
    )
  ),
  'regras_especiais', jsonb_build_object(
    'limite_retornos', 3,
    'total_pacientes_dia', 8
  ),
  'mensagens', jsonb_build_object(
    'consulta', 'Valor da consulta: R$ 230,00 (espécie ou PIX). Mapeamento de Retina: R$ 150,00.',
    'idade', 'Atendimento a partir de 5 anos.',
    'retornos', 'Limite de 3 retornos por dia.'
  )
)
WHERE medico_id = '3e3489cf-9da8-408a-89c1-6cef5c950297';

-- Dra. Camila Helena (Psicóloga)
UPDATE business_rules
SET config = jsonb_build_object(
  'convenios', jsonb_build_array('Particular', 'Medprev', 'AgendaVale'),
  'idade_minima', 11,
  'valor_particular', 350.00,
  'forma_pagamento', 'somente espécie',
  'servicos', jsonb_build_object(
    'consulta_psicologica', jsonb_build_object(
      'nome', 'Consulta Psicológica',
      'valor', 350.00,
      'ativo', true
    ),
    'sessao_psicologica', jsonb_build_object(
      'nome', 'Sessão Psicológica',
      'valor', 250.00,
      'ativo', true
    ),
    'pacote_10_sessoes', jsonb_build_object(
      'nome', 'Pacote 10 Sessões',
      'valor', 2000.00,
      'valor_unitario', 200.00,
      'ativo', true
    )
  ),
  'horarios', jsonb_build_object(
    'sexta', jsonb_build_object(
      'ativo', true,
      'tipo', 'hora_marcada',
      'frequencia', 'quinzenal',
      'slots', jsonb_build_array('14:00', '14:40', '15:20', '16:00'),
      'pacientes', 4
    )
  ),
  'regras_especiais', jsonb_build_object(
    'frequencia_atendimento', 'quinzenal',
    'tipo_agendamento', 'hora_marcada'
  ),
  'mensagens', jsonb_build_object(
    'consulta', 'Consulta: R$ 350,00. Sessão: R$ 250,00. Pacote 10 sessões: R$ 2.000,00 (R$ 200,00 cada).',
    'pagamento', 'Pagamento somente em espécie.',
    'idade', 'Atendimento a partir de 11 anos.',
    'frequencia', 'Atendimento de 15 em 15 dias (quinzenal).'
  )
)
WHERE medico_id = 'c5258941-9bf8-4f29-88cb-dd9077f78088';

-- Dr. Darcy Muritiba (Proctologista)
UPDATE business_rules
SET config = jsonb_build_object(
  'convenios', jsonb_build_array('Unimed', 'Bradesco', 'Postal', 'Mineração', 'Assefaz', 'Codevasf', 'Cassi', 'Asfeb', 'Compesa', 'Casseb', 'Medprev', 'AgendaVale', 'Particular'),
  'idade_minima', 16,
  'valor_particular', 500.00,
  'forma_pagamento', 'espécie ou PIX',
  'servicos', jsonb_build_object(
    'consulta_proctologica', jsonb_build_object(
      'nome', 'Consulta Proctológica',
      'valor', 500.00,
      'ativo', true
    ),
    'colonoscopia', jsonb_build_object(
      'nome', 'Colonoscopia',
      'valor', null,
      'ativo', true,
      'requer_preparo', true
    )
  ),
  'horarios', jsonb_build_object(
    'quinta', jsonb_build_object(
      'manha', jsonb_build_object(
        'ativo', true,
        'tipo', 'consulta',
        'grupos', jsonb_build_array(
          jsonb_build_object('horario', '09:00', 'pacientes', 6, 'local', 'clínica', 'ficha_antes', 15, 'ficha_fim', '09:30'),
          jsonb_build_object('horario', '10:00', 'pacientes', 4, 'local', 'clínica', 'ficha_antes', 15, 'ficha_fim', '10:20')
        )
      ),
      'tarde', jsonb_build_object(
        'ativo', true,
        'tipo', 'colonoscopia',
        'pacientes', 4,
        'preparo', 'tarde'
      )
    )
  ),
  'mensagens', jsonb_build_object(
    'consulta', 'Consulta particular: R$ 500,00 (espécie ou PIX).',
    'idade', 'Atendimento a partir de 16 anos.',
    'colonoscopia', 'Colonoscopia somente às quintas-feiras à tarde. Será passado preparo da tarde.'
  )
)
WHERE medico_id = '8f59fe17-4bf9-4134-b7aa-626249966776';

-- Dr. Pedro Francisco (Ultrassonografista)
UPDATE business_rules
SET config = jsonb_build_object(
  'convenios', jsonb_build_array('Postal', 'Mineração', 'Camed', 'Assefaz', 'Cassic', 'Asfeb', 'Compesa', 'Casseb', 'Fusex', 'Unimed', 'Medprev', 'AgendaVale', 'Particular'),
  'idade_minima', 0,
  'forma_pagamento', 'espécie ou PIX',
  'servicos', jsonb_build_object(
    'ultrassonografia', jsonb_build_object(
      'nome', 'Ultrassonografia',
      'valor', null,
      'ativo', true
    )
  ),
  'horarios', jsonb_build_object(
    'segunda', jsonb_build_object('ativo', true, 'inicio', '07:00', 'pacientes', 8, 'ficha_inicio', '07:00', 'ficha_fim', '09:00'),
    'terca', jsonb_build_object('ativo', true, 'inicio', '07:00', 'pacientes', 8, 'ficha_inicio', '07:00', 'ficha_fim', '09:00'),
    'quarta', jsonb_build_object('ativo', true, 'inicio', '07:00', 'pacientes', 8, 'ficha_inicio', '07:00', 'ficha_fim', '09:00'),
    'quinta', jsonb_build_object('ativo', true, 'inicio', '07:00', 'pacientes', 8, 'ficha_inicio', '07:00', 'ficha_fim', '09:00'),
    'sexta', jsonb_build_object('ativo', true, 'inicio', '07:00', 'pacientes', 8, 'ficha_inicio', '07:00', 'ficha_fim', '09:00')
  ),
  'regras_especiais', jsonb_build_object(
    'idade_vacinacao', 'De 2 anos ou menos só realiza se vacinado',
    'convenios_enviar_guia', jsonb_build_array('Postal', 'Mineração', 'Camed', 'Assefaz', 'Cassic', 'Asfeb', 'Compesa', 'Casseb', 'Fusex'),
    'unimed_coparticipacao', 'somente especial',
    'guia_autorizada_validade', jsonb_build_array('Medprev', 'AgendaVale', 'Fusex')
  ),
  'mensagens', jsonb_build_object(
    'convenios_guia', 'Para Postal, Mineração, Camed, Assefaz, Cassic, Asfeb, Compesa, Casseb e Fusex: enviar foto da guia e carteirinha para autorização. Confirmar agendamento após autorizado.',
    'unimed', 'Unimed: vem autorizada ou autorizamos aqui. Coparticipação somente em especial.',
    'guia_autorizada', 'Medprev, AgendaVale e Fusex: guia deve vir autorizada e com validade no dia.',
    'pagamento', 'Particular: espécie ou PIX.',
    'idade', 'Sem idade mínima. De 2 anos ou menos só realiza se vacinado.'
  )
)
WHERE medico_id = '4be6af8b-1f81-4fa2-8264-90400fbafff7';

-- =====================================================
-- 3. ATUALIZAR OBSERVAÇÕES DOS MÉDICOS
-- =====================================================

UPDATE medicos SET observacoes = 'NUTRICIONISTA - Convênios: Medprev, AgendaVale (sem retorno), Mineração (1 pac/dia), Codevasf, Postal (enviar guia para autorização), Fusex (guia autorizada com validade). Valor: R$ 350,00 (somente espécie). Terça e Sexta: 5 pacientes a partir das 14h. Ficha: 13:30 às 15:00.' 
WHERE id = 'd5a0950a-e7c6-46e1-be98-455ac59b2f10';

UPDATE medicos SET observacoes = 'OFTALMOLOGISTA - Convênios: Medprev, AgendaVale, Óticas/SEMARY PREV. Idade mín: 5 anos. Consulta: R$ 230,00. Mapeamento Retina: R$ 150,00 (espécie ou PIX). Terça e Quinta: 14h (4 pac, ficha 30min antes) e 15h (4 pac, ficha 15min antes). Máx 3 retornos/dia.' 
WHERE id = '3e3489cf-9da8-408a-89c1-6cef5c950297';

UPDATE medicos SET observacoes = 'PSICÓLOGA - Particular, Medprev, AgendaVale. Idade mín: 11 anos. Consulta: R$ 350,00. Sessão: R$ 250,00. Pacote 10 sessões: R$ 2.000,00 (R$ 200/cada). Somente espécie. Sexta QUINZENAL: 14h, 14:40, 15:20, 16h (hora marcada, 4 pacientes).' 
WHERE id = 'c5258941-9bf8-4f29-88cb-dd9077f78088';

UPDATE medicos SET observacoes = 'PROCTOLOGISTA - Convênios: Unimed, Bradesco, Postal, Mineração, Assefaz, Codevasf, Cassi, Asfeb, Compesa, Casseb, Medprev, AgendaVale. Idade mín: 16 anos. Consulta: R$ 500,00 (espécie/PIX). Quinta manhã: 09h (6 pac) e 10h (4 pac). Quinta tarde: 4 colonoscopias (preparo tarde).' 
WHERE id = '8f59fe17-4bf9-4134-b7aa-626249966776';

UPDATE medicos SET observacoes = 'ULTRASSONOGRAFISTA - Convênios: Postal, Mineração, Camed, Assefaz, Cassic, Asfeb, Compesa, Casseb, Fusex (enviar guia+carteirinha), Unimed (autoriza aqui, copart. especial), Medprev, AgendaVale, Fusex (guia autorizada com validade). Particular: espécie/PIX. Seg-Sex: 8 pac a partir 7h. Ficha: 7h-9h. Menores de 2 anos: só vacinado.' 
WHERE id = '4be6af8b-1f81-4fa2-8264-90400fbafff7';
