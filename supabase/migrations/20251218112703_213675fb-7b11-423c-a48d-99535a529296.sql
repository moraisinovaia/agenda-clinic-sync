
-- Atualizar business_rules do "Teste Ergométrico - Dr. Marcelo" com distribuicao_fichas e atendimento_inicio
UPDATE business_rules 
SET config = jsonb_build_object(
  'tipo_agendamento', 'ordem_chegada',
  'permite_agendamento_online', true,
  'servicos', jsonb_build_object(
    'Teste Ergométrico', jsonb_build_object(
      'ativo', true,
      'dias', jsonb_build_array(2, 3, 4),
      'periodos', jsonb_build_object(
        'manha', jsonb_build_object(
          'ativo', true,
          'inicio', '07:00',
          'fim', '12:00',
          'limite', 9,
          'dias_especificos', jsonb_build_array(3),
          'distribuicao_fichas', '07:00 às 09:30',
          'atendimento_inicio', '07:45'
        ),
        'tarde', jsonb_build_object(
          'ativo', true,
          'inicio', '13:00',
          'fim', '17:00',
          'limite', 9,
          'dias_especificos', jsonb_build_array(2, 4),
          'distribuicao_fichas', '13:00 às 15:00',
          'atendimento_inicio', '13:45'
        ),
        'noite', jsonb_build_object('ativo', false)
      )
    )
  )
),
updated_at = now()
WHERE medico_id = '9d5d0e63-098b-4282-aa03-db3c7e012579';
