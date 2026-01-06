
-- =====================================================
-- CORREÇÕES GERAIS DOS CARDIOLOGISTAS ENDOGASTRO
-- =====================================================

-- =====================================================
-- 1. CRIAR ATENDIMENTOS FALTANTES PARA DR. DIEGO TOMÁS E DR. MAX
-- =====================================================
INSERT INTO atendimentos (cliente_id, medico_id, nome, tipo, valor_particular, coparticipacao_unimed_20, coparticipacao_unimed_40, ativo)
VALUES 
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '04505052-89c5-4090-9921-806a6fc7b544', 'Consulta Cardiológica', 'consulta', 280, NULL, NULL, true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '04505052-89c5-4090-9921-806a6fc7b544', 'ECG', 'exame', 80, 4.65, 9.30, true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '04505052-89c5-4090-9921-806a6fc7b544', 'MAPA', 'exame', 220, NULL, NULL, true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '04505052-89c5-4090-9921-806a6fc7b544', 'Holter', 'exame', 220, NULL, NULL, true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '04505052-89c5-4090-9921-806a6fc7b544', 'Teste Ergométrico', 'exame', 250, 26.69, 53.38, true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '04505052-89c5-4090-9921-806a6fc7b544', 'ECO', 'exame', 300, NULL, NULL, true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '04505052-89c5-4090-9921-806a6fc7b544', 'Retorno Cardiológico', 'retorno', NULL, NULL, NULL, true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '84f434dc-21f6-41a9-962e-9b0722a0e2d4', 'Consulta Cardiológica', 'consulta', 280, NULL, NULL, true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '84f434dc-21f6-41a9-962e-9b0722a0e2d4', 'ECG', 'exame', 80, 4.65, 9.30, true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '84f434dc-21f6-41a9-962e-9b0722a0e2d4', 'MAPA', 'exame', 220, NULL, NULL, true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '84f434dc-21f6-41a9-962e-9b0722a0e2d4', 'Holter', 'exame', 220, NULL, NULL, true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '84f434dc-21f6-41a9-962e-9b0722a0e2d4', 'Teste Ergométrico', 'exame', 250, 26.69, 53.38, true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 2. ATUALIZAR VALORES NOS ATENDIMENTOS DE DR. HEVERSON
-- =====================================================
UPDATE atendimentos SET valor_particular = 280 WHERE medico_id = 'fdb7862c-e83d-4294-a36c-a61f177c9487' AND nome = 'Consulta Cardiológica';
UPDATE atendimentos SET valor_particular = 80, coparticipacao_unimed_20 = 4.65, coparticipacao_unimed_40 = 9.30 WHERE medico_id = 'fdb7862c-e83d-4294-a36c-a61f177c9487' AND nome = 'ECG';
UPDATE atendimentos SET valor_particular = 220 WHERE medico_id = 'fdb7862c-e83d-4294-a36c-a61f177c9487' AND nome = 'MAPA';
UPDATE atendimentos SET valor_particular = 220 WHERE medico_id = 'fdb7862c-e83d-4294-a36c-a61f177c9487' AND nome = 'Holter';
UPDATE atendimentos SET valor_particular = 250, coparticipacao_unimed_20 = 26.69, coparticipacao_unimed_40 = 53.38 WHERE medico_id = 'fdb7862c-e83d-4294-a36c-a61f177c9487' AND nome = 'Teste Ergométrico';

-- =====================================================
-- 3. CRIAR ATENDIMENTOS FALTANTES PARA DR. ARISTÓFILO
-- =====================================================
INSERT INTO atendimentos (cliente_id, medico_id, nome, tipo, valor_particular, coparticipacao_unimed_20, coparticipacao_unimed_40, ativo)
VALUES 
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'e4298fe4-1d73-4099-83e0-8581cabb7e96', 'Consulta Cardiológica', 'consulta', 280, NULL, NULL, true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'e4298fe4-1d73-4099-83e0-8581cabb7e96', 'ECG', 'exame', 80, 4.65, 9.30, true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'e4298fe4-1d73-4099-83e0-8581cabb7e96', 'MAPA', 'exame', 220, NULL, NULL, true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'e4298fe4-1d73-4099-83e0-8581cabb7e96', 'Holter', 'exame', 220, NULL, NULL, true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'e4298fe4-1d73-4099-83e0-8581cabb7e96', 'Teste Ergométrico', 'exame', 250, 26.69, 53.38, true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'e4298fe4-1d73-4099-83e0-8581cabb7e96', 'ECO', 'exame', 300, NULL, NULL, true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'e4298fe4-1d73-4099-83e0-8581cabb7e96', 'Retorno Cardiológico', 'retorno', NULL, NULL, NULL, true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 4. CORRIGIR IDADE MÍNIMA DOS CARDIOLOGISTAS
-- =====================================================
UPDATE medicos SET idade_minima = 15
WHERE id IN ('04505052-89c5-4090-9921-806a6fc7b544', '84f434dc-21f6-41a9-962e-9b0722a0e2d4', 'fdb7862c-e83d-4294-a36c-a61f177c9487', 'e4298fe4-1d73-4099-83e0-8581cabb7e96');

-- =====================================================
-- 5. DELETAR DISTRIBUIÇÕES ATUAIS DE MAPA E HOLTER
-- =====================================================
DELETE FROM distribuicao_recursos WHERE recurso_id IN ('403a0030-0922-4050-a278-239ca2781098', '0d80b73f-e0b0-4b46-98fe-d2b09ae4952b') AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253';

-- =====================================================
-- 6. INSERIR NOVAS DISTRIBUIÇÕES MAPA
-- =====================================================
INSERT INTO distribuicao_recursos (cliente_id, recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, ativo) VALUES 
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '403a0030-0922-4050-a278-239ca2781098', '84f434dc-21f6-41a9-962e-9b0722a0e2d4', 1, 2, 'manha', '08:00', true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '403a0030-0922-4050-a278-239ca2781098', '04505052-89c5-4090-9921-806a6fc7b544', 1, 2, 'manha', '08:00', true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '403a0030-0922-4050-a278-239ca2781098', '04505052-89c5-4090-9921-806a6fc7b544', 2, 2, 'manha', '08:00', true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '403a0030-0922-4050-a278-239ca2781098', 'e4298fe4-1d73-4099-83e0-8581cabb7e96', 2, 4, 'manha', '08:00', true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '403a0030-0922-4050-a278-239ca2781098', '04505052-89c5-4090-9921-806a6fc7b544', 3, 2, 'manha', '08:00', true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '403a0030-0922-4050-a278-239ca2781098', 'e4298fe4-1d73-4099-83e0-8581cabb7e96', 3, 2, 'manha', '08:00', true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '403a0030-0922-4050-a278-239ca2781098', '04505052-89c5-4090-9921-806a6fc7b544', 4, 4, 'manha', '08:00', true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '403a0030-0922-4050-a278-239ca2781098', 'fdb7862c-e83d-4294-a36c-a61f177c9487', 4, 4, 'manha', '08:00', true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '403a0030-0922-4050-a278-239ca2781098', '04505052-89c5-4090-9921-806a6fc7b544', 5, 2, 'manha', '08:00', true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '403a0030-0922-4050-a278-239ca2781098', 'fdb7862c-e83d-4294-a36c-a61f177c9487', 5, 2, 'manha', '08:00', true);

-- =====================================================
-- 7. INSERIR NOVAS DISTRIBUIÇÕES HOLTER
-- =====================================================
INSERT INTO distribuicao_recursos (cliente_id, recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, ativo) VALUES 
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '0d80b73f-e0b0-4b46-98fe-d2b09ae4952b', '84f434dc-21f6-41a9-962e-9b0722a0e2d4', 1, 1, 'manha', '08:00', true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '0d80b73f-e0b0-4b46-98fe-d2b09ae4952b', '04505052-89c5-4090-9921-806a6fc7b544', 1, 1, 'manha', '08:00', true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '0d80b73f-e0b0-4b46-98fe-d2b09ae4952b', 'e4298fe4-1d73-4099-83e0-8581cabb7e96', 2, 2, 'manha', '08:00', true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '0d80b73f-e0b0-4b46-98fe-d2b09ae4952b', '84f434dc-21f6-41a9-962e-9b0722a0e2d4', 3, 1, 'manha', '08:00', true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '0d80b73f-e0b0-4b46-98fe-d2b09ae4952b', '04505052-89c5-4090-9921-806a6fc7b544', 3, 1, 'manha', '08:00', true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '0d80b73f-e0b0-4b46-98fe-d2b09ae4952b', 'fdb7862c-e83d-4294-a36c-a61f177c9487', 3, 1, 'manha', '08:00', true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '0d80b73f-e0b0-4b46-98fe-d2b09ae4952b', 'fdb7862c-e83d-4294-a36c-a61f177c9487', 4, 2, 'manha', '08:00', true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '0d80b73f-e0b0-4b46-98fe-d2b09ae4952b', '04505052-89c5-4090-9921-806a6fc7b544', 5, 1, 'manha', '08:00', true),
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '0d80b73f-e0b0-4b46-98fe-d2b09ae4952b', 'fdb7862c-e83d-4294-a36c-a61f177c9487', 5, 1, 'manha', '08:00', true);

-- =====================================================
-- 8. ATUALIZAR BUSINESS_RULES DO DR. HEVERSON (já existe)
-- =====================================================
UPDATE business_rules 
SET config = '{
  "idade_minima": 15,
  "exames_nao_realizados": ["ECO", "Ecocardiograma"],
  "pacotes_especiais": [{"nome": "ECG + Consulta", "servicos": ["ECG", "Consulta Cardiológica"], "valor": 350, "economia": 10}],
  "restricoes": {"nao_mistura_exames": true, "consulta_ecg_permitido": true, "ordem_agendamento": "exames_primeiro_depois_consultas", "observacao": "NÃO misturar consultas com exames (exceto Consulta + ECG). Agendar exames primeiro, depois consultas. NÃO FAZ Ecocardiograma."},
  "entrega_resultados": {"Holter": {"prazo_dias": 3, "tipo": "dias_uteis"}, "MAPA": {"prazo_dias": 5, "tipo": "dias_uteis", "observacao": "Depende do dia que médico estiver na clínica"}, "ECG": {"prazo_dias": 3, "tipo": "dias_uteis", "observacao": "Se médico estiver na clínica, libera no mesmo dia"}, "TESTE ERGOMÉTRICO": {"prazo_dias": 0, "tipo": "mesmo_dia"}},
  "servicos": {"Consulta Cardiológica": {"valor_particular": 280, "idade_minima": 15}, "ECG": {"valor_particular": 80, "coparticipacao_unimed": {"20": 4.65, "40": 9.30}, "agendar_na_agenda": "JOANA"}, "MAPA": {"valor_particular": 220, "agendar_na_agenda": "JOANA", "restricoes": ["Não agendar antes de feriado", "Sem hemodiálise no mesmo dia", "Retirar aparelho no dia seguinte"], "horario_instalacao": "08:00"}, "HOLTER": {"valor_particular": 220, "agendar_na_agenda": "JOANA", "restricoes": ["Não agendar antes de feriado", "Sem hemodiálise no mesmo dia", "Retirar aparelho no dia seguinte"], "horario_instalacao": "08:00"}, "TESTE ERGOMÉTRICO": {"valor_particular": 250, "coparticipacao_unimed": {"20": 26.69, "40": 53.38}, "idade_minima": 18, "peso_maximo_kg": 150}}
}'::jsonb
WHERE medico_id = 'fdb7862c-e83d-4294-a36c-a61f177c9487' AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253' AND ativo = true;
