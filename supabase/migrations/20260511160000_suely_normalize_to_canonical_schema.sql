-- Dra. Maria Suely Amorim Mendes — normaliza business_rules.config para formato canônico.
--
-- Estado anterior (legacy):
--   - config.convenios (array)            ← deveria ser config.convenios_aceitos
--   - config.servicos (array de objetos)  ← deveria ser object {nome: detalhes}
--   - Periodos com horario_inicio/horario_fim/limite_pacientes ← canônico usa inicio/fim/limite
--
-- Estado canônico (Dr. Marcelo + 38 médicos):
--   - config.convenios_aceitos: text[]
--   - config.servicos: { "Consulta": { periodos: { manha: { ativo, inicio, fim, limite, ... } } } }
--
-- Necessário pro llm-agent-api conseguir montar o prompt com convênios aceitos
-- e regras de serviços da Suely (caso contrário responde "não atendemos convênios").

UPDATE public.business_rules
SET config = jsonb_set(
  jsonb_set(
    jsonb_set(
      config - 'convenios',                         -- remove chave 'convenios'
      '{convenios_aceitos}',                        -- adiciona 'convenios_aceitos' com mesmo valor
      COALESCE(config->'convenios', '[]'::jsonb)
    ),
    '{servicos}',                                   -- substitui 'servicos' array por object
    (
      SELECT jsonb_object_agg(
        servico->>'nome',
        jsonb_build_object(
          'tipo', servico->>'tipo',
          'permite_online', COALESCE((servico->>'permite_online')::boolean, true),
          'dias_atendimento', servico->'dias_atendimento',
          'periodos', jsonb_build_object(
            'manha', jsonb_build_object(
              'ativo',  COALESCE((servico->'periodos'->'manha'->>'ativo')::boolean, false),
              'inicio', servico->'periodos'->'manha'->>'horario_inicio',
              'fim',    servico->'periodos'->'manha'->>'horario_fim',
              'limite', COALESCE((servico->'periodos'->'manha'->>'limite_pacientes')::int, 0),
              'dias_especificos', servico->'dias_atendimento'
            ),
            'tarde', jsonb_build_object(
              'ativo',  COALESCE((servico->'periodos'->'tarde'->>'ativo')::boolean, false),
              'inicio', servico->'periodos'->'tarde'->>'horario_inicio',
              'fim',    servico->'periodos'->'tarde'->>'horario_fim',
              'limite', COALESCE((servico->'periodos'->'tarde'->>'limite_pacientes')::int, 0),
              'dias_especificos', servico->'dias_atendimento'
            )
          )
        )
      )
      FROM jsonb_array_elements(config->'servicos') AS servico
    )
  ),
  '{permite_agendamento_online}',                   -- garante a chave raiz canônica
  COALESCE(config->'permite_agendamento_online', 'true'::jsonb)
)
WHERE id = '901daff7-bae6-4d0e-8720-2d0dc9983a24'
  AND jsonb_typeof(config->'servicos') = 'array';  -- só roda se ainda no formato legacy (idempotente)
