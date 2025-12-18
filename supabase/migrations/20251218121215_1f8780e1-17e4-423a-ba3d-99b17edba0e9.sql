-- Atualizar business_rules para adicionar Retorno Endocrinológico
UPDATE business_rules 
SET config = config || jsonb_build_object(
  'servicos', (config->'servicos') || jsonb_build_object(
    'Retorno Endocrinológico', jsonb_build_object(
      'tipo', 'ordem_chegada',
      'permite_online', true,
      'dias_semana', ARRAY[1,2,3,4,5],
      'periodos', jsonb_build_object(
        'manha', jsonb_build_object(
          'inicio', '08:00',
          'fim', '10:00',
          'distribuicao_fichas', '08:00 às 10:00',
          'atendimento_inicio', '08:45',
          'limite', 9
        ),
        'tarde', jsonb_build_object(
          'inicio', '13:00',
          'fim', '15:00',
          'distribuicao_fichas', '13:00 às 15:00',
          'atendimento_inicio', '14:45',
          'limite', 9,
          'dias_especificos', ARRAY[2,3]
        )
      )
    )
  )
),
version = version + 1
WHERE medico_id = '32d30887-b876-4502-bf04-e55d7fb55b50'
AND cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';