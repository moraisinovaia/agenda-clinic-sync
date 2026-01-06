
-- =====================================================
-- CONFIGURAÇÃO: Dra. Luziane Sabino e Dra. Thalita Mariano
-- Cliente: ENDOGASTRO (39e120b4-5fb7-4d6f-9f91-a598a5bbd253)
-- =====================================================

-- 1. Atendimentos para Dra. Luziane Sabino
INSERT INTO atendimentos (medico_id, nome, tipo, valor_particular, ativo, cliente_id)
VALUES 
  -- Consulta (apenas Particular)
  ('7902d115-4300-4fa2-8fc0-751594aa5c9c', 'Consulta Gastroenterológica e Hepatologia', 'consulta', 500.00, true, '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'),
  -- Endoscopia (EDA)
  ('7902d115-4300-4fa2-8fc0-751594aa5c9c', 'Endoscopia (EDA)', 'exame', 500.00, true, '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'),
  -- Testes de Hidrogênio
  ('7902d115-4300-4fa2-8fc0-751594aa5c9c', 'Teste de Hidrogênio - SIBO', 'exame', 500.00, true, '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'),
  ('7902d115-4300-4fa2-8fc0-751594aa5c9c', 'Teste de Hidrogênio - Lactose', 'exame', 300.00, true, '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'),
  ('7902d115-4300-4fa2-8fc0-751594aa5c9c', 'Teste de Hidrogênio - Frutose', 'exame', 400.00, true, '39e120b4-5fb7-4d6f-9f91-a598a5bbd253');

-- 2. Atendimento para Dra. Thalita Mariano
INSERT INTO atendimentos (medico_id, nome, tipo, valor_particular, ativo, cliente_id)
VALUES 
  ('ab4ac803-51cc-455a-898b-4ad7f1cda137', 'Endoscopia (EDA)', 'exame', 500.00, true, '39e120b4-5fb7-4d6f-9f91-a598a5bbd253');

-- 3. Atualizar idade mínima Dra. Luziane
UPDATE medicos 
SET idade_minima = 16,
    observacoes = 'Gastro e Hepato. Consultas APENAS Particular (R$ 500). Endoscopia aceita: Unimed, Mineração, Bradesco, Agenda Vale, MedPrev. Testes de Hidrogênio (SIBO, Lactose, Frutose) são laudados por ela mas agendados na agenda de Lorena Ribeiro às quintas 07:00. NÃO FAZ teste com Metano. Testes: idade mínima 4 anos, paciente deve conseguir tomar 250ml de solução.'
WHERE id = '7902d115-4300-4fa2-8fc0-751594aa5c9c';

-- 4. Atualizar observações Dra. Thalita
UPDATE medicos 
SET observacoes = 'Faz APENAS Endoscopia às terças-feiras. FACHESF: NÃO atende carteiras que começam com nº 43.'
WHERE id = 'ab4ac803-51cc-455a-898b-4ad7f1cda137';

-- 5. Business Rules Dra. Luziane Sabino
UPDATE business_rules
SET config = jsonb_build_object(
  'idade_minima', 16,
  'convenios_aceitos', jsonb_build_object(
    'consulta', ARRAY['Particular'],
    'endoscopia', ARRAY['Unimed', 'Mineração', 'Bradesco', 'Agenda Vale', 'MedPrev']
  ),
  'forma_pagamento', jsonb_build_object(
    'particular', jsonb_build_object(
      'valor_consulta', 500,
      'formas', ARRAY['Espécie', 'PIX']
    )
  ),
  'testes_hidrogenio', jsonb_build_object(
    'lauda_por', 'Dra. Luziane Sabino',
    'agenda_em', 'Lorena Ribeiro',
    'agenda_id', '699e72a8-2d0d-4d4d-82b7-f69bd9f84b24',
    'dia', 'quinta',
    'horario', '07:00',
    'pacientes_max', 5,
    'duracao', '3h a 3h30min',
    'idade_minima', 4,
    'nao_faz_metano', true,
    'observacao', 'Paciente deve conseguir tomar 250ml de solução. Chegar em ponto.',
    'valores', jsonb_build_object(
      'SIBO', 500,
      'Lactose', 300,
      'Frutose', 400
    )
  ),
  'servicos', jsonb_build_array(
    jsonb_build_object(
      'nome', 'Endoscopia (EDA)',
      'tipo', 'exame',
      'convenios', ARRAY['Unimed', 'Mineração', 'Bradesco', 'Agenda Vale', 'MedPrev'],
      'dias', ARRAY['quarta'],
      'periodos', jsonb_build_object(
        'manha', jsonb_build_object(
          'ativo', true,
          'inicio', '07:30',
          'fim', '12:00',
          'pacientes', 5,
          'ficha_inicio', '07:00',
          'ficha_fim', '08:00'
        )
      )
    ),
    jsonb_build_object(
      'nome', 'Consulta Gastroenterológica e Hepatologia',
      'tipo', 'consulta',
      'convenios', ARRAY['Particular'],
      'valor_particular', 500,
      'dias', ARRAY['sexta'],
      'periodos', jsonb_build_object(
        'tarde', jsonb_build_object(
          'ativo', true,
          'horarios_especificos', jsonb_build_array(
            jsonb_build_object('horario', '14:00', 'pacientes', 3, 'ficha', '15m antes às 15:00'),
            jsonb_build_object('horario', '15:00', 'pacientes', 2, 'ficha', '15m antes às 15:20'),
            jsonb_build_object('horario', '15:30', 'pacientes', 1, 'ficha', '15m antes às 16:00')
          ),
          'total_pacientes', 6
        )
      )
    )
  ),
  'mensagens', jsonb_build_object(
    'consulta', 'Consulta Gastroenterológica e Hepatologia com Dra. Luziane Sabino. APENAS Particular (R$ 500,00 - Espécie ou PIX).',
    'endoscopia', 'Endoscopia com Dra. Luziane Sabino. Convênios aceitos: Unimed, Mineração, Bradesco, Agenda Vale, MedPrev.',
    'testes_hidrogenio', 'Testes de Hidrogênio (SIBO R$500, Lactose R$300, Frutose R$400) laudados por Dra. Luziane. Agendar na agenda de Lorena Ribeiro às quintas 07:00. Duração 3h a 3h30min. Idade mínima 4 anos. NÃO faz teste com Metano. Paciente deve conseguir tomar 250ml de solução.'
  )
),
updated_at = NOW()
WHERE medico_id = '7902d115-4300-4fa2-8fc0-751594aa5c9c';

-- 6. Business Rules Dra. Thalita Mariano
UPDATE business_rules
SET config = jsonb_build_object(
  'convenios_aceitos', ARRAY['Unimed', 'Bradesco', 'Postal', 'Mineração', 'FACHESF', 'FUSEX', 'Camed', 'Assefaz', 'Codevasf', 'Cassic', 'Cassi', 'Asfeb', 'Compesa', 'Casseb', 'CapSaúde', 'Particular'],
  'restricoes_convenio', jsonb_build_object(
    'FACHESF', jsonb_build_object(
      'nao_aceita_carteira_comeca_com', '43',
      'mensagem', 'FACHESF: Não atende carteiras que começam com nº 43'
    )
  ),
  'servicos', jsonb_build_array(
    jsonb_build_object(
      'nome', 'Endoscopia (EDA)',
      'tipo', 'exame',
      'convenios', ARRAY['Unimed', 'Bradesco', 'Postal', 'Mineração', 'FACHESF', 'FUSEX', 'Camed', 'Assefaz', 'Codevasf', 'Cassic', 'Cassi', 'Asfeb', 'Compesa', 'Casseb', 'CapSaúde', 'Particular'],
      'dias', ARRAY['terca'],
      'apenas_endoscopia', true,
      'periodos', jsonb_build_object(
        'manha', jsonb_build_object(
          'ativo', true,
          'inicio', '08:00',
          'fim', '12:00',
          'pacientes', 5,
          'ficha', '15m antes às 07:00'
        )
      )
    )
  ),
  'mensagens', jsonb_build_object(
    'endoscopia', 'Endoscopia com Dra. Thalita Mariano às terças-feiras. Convênios: Unimed, Bradesco, Postal, Mineração, FACHESF (exceto carteiras nº 43), FUSEX, Camed, Assefaz, Codevasf, Cassic, Cassi, Asfeb, Compesa, Casseb, CapSaúde, Particular.',
    'restricao_fachesf', 'ATENÇÃO: FACHESF - Não atendemos carteiras que começam com número 43.'
  ),
  'observacoes', 'Dra. Thalita faz APENAS Endoscopia às terças-feiras. FACHESF: NÃO atende carteiras que começam com nº 43.'
),
updated_at = NOW()
WHERE medico_id = 'ab4ac803-51cc-455a-898b-4ad7f1cda137';

-- 7. Atualizar observações Lorena Ribeiro para incluir Testes de Hidrogênio
UPDATE medicos 
SET observacoes = COALESCE(observacoes, '') || ' | TESTES DE HIDROGÊNIO: Quintas às 07:00, 5 pacientes, laudados por Dra. Luziane Sabino. SIBO R$500, Lactose R$300, Frutose R$400. Duração 3h a 3h30min. Idade mínima 4 anos. NÃO faz Metano. Paciente deve tomar 250ml de solução.'
WHERE id = '699e72a8-2d0d-4d4d-82b7-f69bd9f84b24';
