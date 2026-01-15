-- Configuração Completa: Dra. Adriana Carla de Sena (ID: 32d30887-b876-4502-bf04-e55d7fb55b50)

-- 1. Atualizar convênios aceitos na tabela medicos
UPDATE medicos 
SET convenios_aceitos = ARRAY['PARTICULAR', 'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED INTERCÂMBIO', 'UNIMED 40%', 'UNIMED 20%'],
    updated_at = now()
WHERE id = '32d30887-b876-4502-bf04-e55d7fb55b50';

-- 2. Atualizar business_rules - tipo_agendamento e configuração completa dos serviços
UPDATE business_rules 
SET config = jsonb_build_object(
  'tipo_agendamento', 'ordem_chegada',
  'servicos', jsonb_build_object(
    'Consulta Endocrinológica', jsonb_build_object(
      'ativo', true,
      'periodos', jsonb_build_object(
        'manha', jsonb_build_object(
          'ativo', true,
          'dias_especificos', '[1, 2, 3, 4, 5]'::jsonb,
          'contagem_inicio', '07:00',
          'contagem_fim', '12:00',
          'horario_inicio', '08:00',
          'horario_fim', '10:00',
          'atendimento_inicio', '08:45',
          'limite', 9
        ),
        'tarde', jsonb_build_object(
          'ativo', true,
          'dias_especificos', '[2, 3]'::jsonb,
          'contagem_inicio', '13:00',
          'contagem_fim', '18:00',
          'horario_inicio', '13:00',
          'horario_fim', '15:00',
          'atendimento_inicio', '14:45',
          'limite', 9
        )
      )
    ),
    'Retorno Endocrinológico', jsonb_build_object(
      'ativo', true,
      'periodos', jsonb_build_object(
        'manha', jsonb_build_object(
          'ativo', true,
          'dias_especificos', '[1, 2, 3, 4, 5]'::jsonb,
          'contagem_inicio', '07:00',
          'contagem_fim', '12:00',
          'horario_inicio', '08:00',
          'horario_fim', '10:00',
          'atendimento_inicio', '08:45',
          'limite', 9
        ),
        'tarde', jsonb_build_object(
          'ativo', true,
          'dias_especificos', '[2, 3]'::jsonb,
          'contagem_inicio', '13:00',
          'contagem_fim', '18:00',
          'horario_inicio', '13:00',
          'horario_fim', '15:00',
          'atendimento_inicio', '14:45',
          'limite', 9
        )
      )
    )
  )
),
updated_at = now()
WHERE medico_id = '32d30887-b876-4502-bf04-e55d7fb55b50';

-- 3. Atualizar valores na tabela atendimentos
-- Consulta Endocrinológica
UPDATE atendimentos 
SET valor_particular = 400.00,
    coparticipacao_unimed_20 = 26.00,
    coparticipacao_unimed_40 = 52.00,
    forma_pagamento = 'especie'
WHERE id = '6b2f01e9-4624-42a6-ab0a-557da9654227';

-- Retorno Endocrinológico
UPDATE atendimentos 
SET valor_particular = 400.00,
    coparticipacao_unimed_20 = 26.00,
    coparticipacao_unimed_40 = 52.00,
    forma_pagamento = 'especie'
WHERE id = '96010447-7869-4299-b0d0-b9fa91e6cea7';