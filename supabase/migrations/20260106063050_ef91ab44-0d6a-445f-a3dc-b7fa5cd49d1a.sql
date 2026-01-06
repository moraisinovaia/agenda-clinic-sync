
-- =====================================================
-- CONFIGURAÇÃO COMPLETA: Dr. Heverson Alex
-- ID: fdb7862c-e83d-4294-a36c-a61f177c9487
-- Cliente: ENDOGASTRO (39e120b4-5fb7-4d6f-9f91-a598a5bbd253)
-- =====================================================

-- 1. Atualizar cadastro do médico
UPDATE medicos SET
  convenios_aceitos = ARRAY[
    'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED INTERCÂMBIO', 
    'UNIMED 40%', 'UNIMED 20%', 'MED PREV', 'AGENDA VALE', 
    'Dr.Exames', 'Clincenter', 'MED CENTER', 'MINERAÇÃO'
  ],
  idade_minima = 15,
  atende_criancas = false,
  atende_adultos = true,
  convenios_restricoes = jsonb_build_object(
    'MAPA', ARRAY['UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED INTERCÂMBIO', 'UNIMED 40%', 'UNIMED 20%'],
    'HOLTER', ARRAY['UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED INTERCÂMBIO', 'UNIMED 40%', 'UNIMED 20%']
  ),
  observacoes = 'UNIMED: Consulta sempre com ECG junto. MAPA/HOLTER não aceita UNIMED. ECG para Teste Ergométrico: intervalo mínimo 15 dias.',
  updated_at = now()
WHERE id = 'fdb7862c-e83d-4294-a36c-a61f177c9487';

-- 2. Limpar atendimentos antigos do Dr. Heverson (se existirem)
DELETE FROM atendimentos 
WHERE medico_id = 'fdb7862c-e83d-4294-a36c-a61f177c9487';

-- 3. Criar atendimentos
INSERT INTO atendimentos (cliente_id, medico_id, nome, tipo, ativo, horarios, observacoes)
VALUES 
(
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  'fdb7862c-e83d-4294-a36c-a61f177c9487',
  'Consulta Cardiológica',
  'consulta',
  true,
  '{"segunda": {"inicio": "09:00", "fim": "09:30", "limite": 6, "ficha_inicio": "09:00", "ficha_fim": "09:30"}, "quinta": {"inicio": "15:30", "fim": "16:30", "limite": 5, "ficha_inicio": "15:45", "ficha_fim": "16:30"}}'::jsonb,
  'Segunda: 6 consultas (09:00-09:30). Quinta: 5 consultas (15:30-16:30). UNIMED sempre com ECG junto.'
),
(
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  'fdb7862c-e83d-4294-a36c-a61f177c9487',
  'Retorno Cardiológico',
  'retorno',
  true,
  '{"quinta": {"inicio": "15:30", "fim": "16:30", "limite": 3, "ficha_inicio": "15:45", "ficha_fim": "16:30"}}'::jsonb,
  'Quinta: 3 retornos (15:30-16:30)'
),
(
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  'fdb7862c-e83d-4294-a36c-a61f177c9487',
  'ECG',
  'exame',
  true,
  '{"segunda": {"inicio": "07:00", "fim": "09:00", "limite": 6}, "quinta": {"inicio": "13:00", "fim": "15:00", "limite": 7}}'::jsonb,
  'Segunda: 6 ECG (07:00-09:00). Quinta: 7 ECG (13:00-15:00). Intervalo mínimo 15 dias para Teste Ergométrico.'
),
(
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  'fdb7862c-e83d-4294-a36c-a61f177c9487',
  'Teste Ergométrico',
  'exame',
  true,
  '{"quinta": {"inicio": "14:00", "fim": "15:00", "limite": 4, "ficha_inicio": "13:30", "ficha_fim": "15:20"}}'::jsonb,
  'Quinta: 4 pacientes (14:00-15:00). Ficha 13:30-15:20. Requer intervalo mínimo 15 dias após ECG.'
),
(
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  'fdb7862c-e83d-4294-a36c-a61f177c9487',
  'MAPA',
  'exame',
  true,
  '{"quarta": {"inicio": "07:40", "fim": "08:15", "limite": 2}, "sexta": {"inicio": "07:40", "fim": "08:15", "limite": 2}}'::jsonb,
  'Quarta e Sexta: 2 pacientes cada. NÃO ACEITA UNIMED.'
),
(
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  'fdb7862c-e83d-4294-a36c-a61f177c9487',
  'Holter',
  'exame',
  true,
  '{"quarta": {"inicio": "07:40", "fim": "08:15", "limite": 1}, "sexta": {"inicio": "07:40", "fim": "08:15", "limite": 1}}'::jsonb,
  'Quarta e Sexta: 1 paciente cada. NÃO ACEITA UNIMED.'
);

-- 4. DELETAR distribuição de recursos existentes do Dr. Heverson (para evitar duplicidade)
DELETE FROM distribuicao_recursos 
WHERE medico_id = 'fdb7862c-e83d-4294-a36c-a61f177c9487';

-- 5. Criar novas distribuições de recursos
-- MAPA - Quarta (dia 3)
INSERT INTO distribuicao_recursos (cliente_id, recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio)
SELECT 
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  id,
  'fdb7862c-e83d-4294-a36c-a61f177c9487',
  3,
  2,
  'manha',
  '07:40'::time
FROM recursos_equipamentos WHERE nome = 'MAPA' AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253';

-- MAPA - Sexta (dia 5)
INSERT INTO distribuicao_recursos (cliente_id, recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio)
SELECT 
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  id,
  'fdb7862c-e83d-4294-a36c-a61f177c9487',
  5,
  2,
  'manha',
  '07:40'::time
FROM recursos_equipamentos WHERE nome = 'MAPA' AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253';

-- HOLTER - Quarta (dia 3)
INSERT INTO distribuicao_recursos (cliente_id, recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio)
SELECT 
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  id,
  'fdb7862c-e83d-4294-a36c-a61f177c9487',
  3,
  1,
  'manha',
  '07:40'::time
FROM recursos_equipamentos WHERE nome = 'HOLTER' AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253';

-- HOLTER - Sexta (dia 5)
INSERT INTO distribuicao_recursos (cliente_id, recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio)
SELECT 
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  id,
  'fdb7862c-e83d-4294-a36c-a61f177c9487',
  5,
  1,
  'manha',
  '07:40'::time
FROM recursos_equipamentos WHERE nome = 'HOLTER' AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253';

-- ECG - Segunda (dia 1)
INSERT INTO distribuicao_recursos (cliente_id, recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio)
SELECT 
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  id,
  'fdb7862c-e83d-4294-a36c-a61f177c9487',
  1,
  6,
  'manha',
  '07:00'::time
FROM recursos_equipamentos WHERE nome = 'ECG' AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253';

-- ECG - Quinta (dia 4)
INSERT INTO distribuicao_recursos (cliente_id, recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio)
SELECT 
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  id,
  'fdb7862c-e83d-4294-a36c-a61f177c9487',
  4,
  7,
  'tarde',
  '13:00'::time
FROM recursos_equipamentos WHERE nome = 'ECG' AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253';

-- 6. Criar recurso TESTE ERGOMÉTRICO se não existir
INSERT INTO recursos_equipamentos (cliente_id, nome, descricao, limite_diario, horario_instalacao, ficha_inicio, ficha_fim, ativo)
SELECT 
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  'TESTE ERGOMÉTRICO',
  'Teste de esforço cardíaco - Dr. Heverson às quintas',
  4,
  '14:00'::time,
  '13:30'::time,
  '15:20'::time,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM recursos_equipamentos 
  WHERE nome = 'TESTE ERGOMÉTRICO' 
  AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
);

-- 7. Atualizar/Criar business_rules
INSERT INTO business_rules (cliente_id, medico_id, config, ativo, version)
VALUES (
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  'fdb7862c-e83d-4294-a36c-a61f177c9487',
  '{
    "restricoes_convenio": {
      "MAPA": {
        "nao_permite": ["UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%"],
        "mensagem": "MAPA não é realizado pela UNIMED para este médico"
      },
      "HOLTER": {
        "nao_permite": ["UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%"],
        "mensagem": "HOLTER não é realizado pela UNIMED para este médico"
      }
    },
    "pacote_obrigatorio": {
      "UNIMED": {
        "Consulta Cardiológica": ["ECG"],
        "mensagem": "Pacientes UNIMED: Consulta sempre acompanhada de ECG"
      }
    },
    "restricoes_intervalo": {
      "ECG_para_TESTE_ERGOMETRICO": {
        "dias_minimo": 15,
        "mensagem": "Após realizar ECG, Teste Ergométrico só pode ser agendado após 15 dias"
      }
    },
    "servicos": {
      "Consulta Cardiológica": {
        "dias": ["segunda", "quinta"],
        "segunda": {"inicio": "09:00", "fim": "09:30", "limite": 6},
        "quinta": {"inicio": "15:30", "fim": "16:30", "limite": 5}
      },
      "Retorno Cardiológico": {
        "dias": ["quinta"],
        "quinta": {"inicio": "15:30", "fim": "16:30", "limite": 3}
      },
      "ECG": {
        "dias": ["segunda", "quinta"],
        "segunda": {"inicio": "07:00", "fim": "09:00", "limite": 6},
        "quinta": {"inicio": "13:00", "fim": "15:00", "limite": 7}
      },
      "Teste Ergométrico": {
        "dias": ["quinta"],
        "quinta": {"inicio": "14:00", "fim": "15:00", "limite": 4, "ficha_inicio": "13:30", "ficha_fim": "15:20"}
      },
      "MAPA": {
        "dias": ["quarta", "sexta"],
        "quarta": {"inicio": "07:40", "fim": "08:15", "limite": 2},
        "sexta": {"inicio": "07:40", "fim": "08:15", "limite": 2}
      },
      "Holter": {
        "dias": ["quarta", "sexta"],
        "quarta": {"inicio": "07:40", "fim": "08:15", "limite": 1},
        "sexta": {"inicio": "07:40", "fim": "08:15", "limite": 1}
      }
    },
    "idade_minima": 15
  }'::jsonb,
  true,
  1
)
ON CONFLICT (medico_id, cliente_id) 
DO UPDATE SET 
  config = EXCLUDED.config,
  updated_at = now(),
  version = business_rules.version + 1;
