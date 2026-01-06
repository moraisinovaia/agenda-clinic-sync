
-- =====================================================
-- CONFIGURAÇÃO: Dr. Rivadávio Espínola e Dr. Cláudio Lustosa
-- =====================================================

-- 1. INSERIR ATENDIMENTOS
-- -----------------------

-- Dr. Rivadávio Espínola - Consulta Clínico Geral
INSERT INTO atendimentos (medico_id, nome, tipo, valor_particular, ativo, cliente_id)
VALUES (
  '55c0597b-0ecc-4ac6-b9e8-168c499ad74f',
  'Consulta Clínico Geral',
  'consulta',
  500.00,
  true,
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
) ON CONFLICT DO NOTHING;

-- Dr. Cláudio Lustosa - Consulta Endocrinológica
INSERT INTO atendimentos (medico_id, nome, tipo, valor_particular, forma_pagamento, ativo, cliente_id)
VALUES (
  'ca046db5-601d-40c3-9462-519f7da4715b',
  'Consulta Endocrinológica',
  'consulta',
  450.00,
  'PIX ou Espécie (PIX obriga Nota Fiscal)',
  true,
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
) ON CONFLICT DO NOTHING;

-- 2. ATUALIZAR BUSINESS_RULES (coluna correta: config)
-- ----------------------------------------------------

-- Dr. Rivadávio Espínola
UPDATE business_rules
SET config = jsonb_build_object(
  'nome', 'Dr. Rivadávio Espínola',
  'especialidade', 'Clínico Geral',
  'idade_minima', 13,
  'tipo_agendamento', 'ordem_chegada',
  'convenios_aceitos', jsonb_build_array('UNIMED', 'BRADESCO', 'POSTAL', 'MINERAÇÃO', 'FUSEX', 'CAMED', 'ASSEFAZ', 'PARTICULAR', 'AGENDA VALE'),
  'restricoes', jsonb_build_object(
    'particular_sus', 'Paciente particular que já é atendido no SUS NÃO será atendido até segunda ordem. VERIFICAR antes de agendar.',
    'verificar_historico_sus', true
  ),
  'servicos', jsonb_build_object(
    'Consulta Clínico Geral', jsonb_build_object(
      'ativo', true,
      'valor', 500,
      'tipo_agendamento', 'ordem_chegada',
      'horario_inicio_ficha', '11:00',
      'horario_fim_ficha', '12:45',
      'dias_atendimento', jsonb_build_array('terça', 'quinta'),
      'limite_total_dia', 10,
      'periodos', jsonb_build_object(
        'bloco_1', jsonb_build_object(
          'horario', '11:00',
          'limite', 5
        ),
        'bloco_2', jsonb_build_object(
          'horario', '12:00',
          'limite', 5
        )
      )
    )
  )
),
updated_at = now()
WHERE medico_id = '55c0597b-0ecc-4ac6-b9e8-168c499ad74f';

-- Dr. Cláudio Lustosa
UPDATE business_rules
SET config = jsonb_build_object(
  'nome', 'Dr. Cláudio Lustosa',
  'especialidade', 'Endocrinologista',
  'idade_minima', 0,
  'tipo_agendamento', 'ordem_chegada',
  'convenios_aceitos', jsonb_build_array('PARTICULAR'),
  'atende_convenio', false,
  'forma_pagamento', jsonb_build_object(
    'aceita', jsonb_build_array('PIX', 'ESPÉCIE'),
    'local', 'Recepção na hora da ficha',
    'regras', 'PIX obrigatoriamente requer Nota Fiscal'
  ),
  'servicos', jsonb_build_object(
    'Consulta Endocrinológica', jsonb_build_object(
      'ativo', true,
      'valor', 450,
      'tipo_agendamento', 'ordem_chegada',
      'horarios_por_dia', jsonb_build_object(
        'segunda', jsonb_build_object(
          'ativo', true,
          'pacientes', 6,
          'horario_medico', '12:00-12:30',
          'ficha_inicio', '11:30',
          'ficha_fim', '13:00'
        ),
        'terça', jsonb_build_object(
          'ativo', true,
          'pacientes', 7,
          'horario_medico', '07:00-07:30',
          'ficha_inicio', '07:00',
          'ficha_fim', '08:00'
        ),
        'quarta', jsonb_build_object(
          'ativo', true,
          'pacientes', 7,
          'horario_medico', '07:00-07:30',
          'ficha_inicio', '07:00',
          'ficha_fim', '08:00'
        ),
        'quinta', jsonb_build_object(
          'ativo', true,
          'pacientes', 9,
          'horario_medico', '12:00-12:30',
          'ficha_inicio', '11:30',
          'ficha_fim', '13:10'
        ),
        'sexta', jsonb_build_object(
          'ativo', true,
          'pacientes', 7,
          'horario_medico', '07:00-07:30',
          'ficha_inicio', '07:00',
          'ficha_fim', '08:00'
        )
      )
    )
  )
),
updated_at = now()
WHERE medico_id = 'ca046db5-601d-40c3-9462-519f7da4715b';

-- 3. ATUALIZAR IDADE MÍNIMA NA TABELA MEDICOS
-- -------------------------------------------

UPDATE medicos
SET idade_minima = 13
WHERE id = '55c0597b-0ecc-4ac6-b9e8-168c499ad74f';

UPDATE medicos
SET idade_minima = 0
WHERE id = 'ca046db5-601d-40c3-9462-519f7da4715b';

-- 4. ATUALIZAR OBSERVAÇÕES DOS MÉDICOS
-- ------------------------------------

UPDATE medicos
SET observacoes = 'ATENÇÃO: Paciente particular que já é atendido no SUS NÃO será atendido até segunda ordem. Verificar histórico antes de agendar. | Atende: Ter/Qui 11h-12:45h (10 pacientes: 5 às 11h + 5 às 12h)'
WHERE id = '55c0597b-0ecc-4ac6-b9e8-168c499ad74f';

UPDATE medicos
SET observacoes = 'APENAS PARTICULAR (não atende convênio). Pagamento: PIX ou Espécie na recepção. PIX obriga Nota Fiscal. | Seg: 6pac 12h | Ter/Qua/Sex: 7pac 07h | Qui: 9pac 12h'
WHERE id = 'ca046db5-601d-40c3-9462-519f7da4715b';
