-- Correção dos limites de pacientes para Dr. Edson
-- Endoscopia: 3 (independente), Consulta + Retorno: 8 (compartilhados)

-- 1. Atualizar limites na tabela atendimentos
UPDATE atendimentos 
SET horarios = jsonb_set(horarios, '{limite}', '3')
WHERE id = '786f9f52-12fa-4389-8688-fdf3044e038f'; -- Endoscopia

UPDATE atendimentos 
SET horarios = jsonb_set(horarios, '{limite}', '8')
WHERE id = '3db2f8fb-b5bf-481b-983a-33f34aa20696'; -- Consulta

UPDATE atendimentos 
SET horarios = jsonb_set(horarios, '{limite}', '8')
WHERE id = 'fed57dd9-9731-450b-8328-696e249416fd'; -- Retorno

-- 2. Atualizar business_rules com grupo_limite para consultas compartilhadas
UPDATE business_rules 
SET config = jsonb_set(
  config,
  '{servicos}',
  '{
    "Endoscopia Digestiva Alta": {
      "duracao": 20,
      "preparo": "jejum_8h",
      "limite_diario": 3,
      "grupo_limite": null,
      "horario_inicio": "07:00",
      "horario_fim": "09:00",
      "dias_semana": ["segunda", "terca", "quarta", "quinta", "sexta"],
      "requer_acompanhante": true
    },
    "Consulta Gastroenterológica": {
      "duracao": 30,
      "preparo": null,
      "limite_diario": 8,
      "grupo_limite": "consultas",
      "horario_inicio": "09:00",
      "horario_fim": "12:00",
      "dias_semana": ["segunda", "terca", "quarta", "quinta", "sexta"],
      "requer_acompanhante": false
    },
    "Retorno Gastroenterológico": {
      "duracao": 20,
      "preparo": null,
      "limite_diario": 8,
      "grupo_limite": "consultas",
      "horario_inicio": "09:00",
      "horario_fim": "12:00",
      "dias_semana": ["segunda", "terca", "quarta", "quinta", "sexta"],
      "requer_acompanhante": false
    }
  }'::jsonb
)
WHERE medico_id = 'cdbfc594-d3de-459f-a9c1-a3f29842273e';

-- 3. Atualizar limite total do período manhã
UPDATE horarios_configuracao 
SET limite_pacientes = 11
WHERE id = '70bddfcb-b7d5-49e0-9f2d-5f91ce8a9b0c';