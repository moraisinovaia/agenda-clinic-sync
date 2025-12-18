
-- Atualizar configuração de Ligadura de Hemorroidas para Dr. Dilson Pereira
-- Permitir agendamento online, compartilhar limite com consultas, sublimite de 1/dia

UPDATE business_rules
SET config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          config,
          '{servicos,ligadura_hemorroidas,permite_agendamento_online}',
          'true'::jsonb
        ),
        '{servicos,ligadura_hemorroidas,compartilha_limite_com}',
        '"consulta_proctologica"'::jsonb
      ),
      '{servicos,ligadura_hemorroidas,limite_proprio}',
      '1'::jsonb
    ),
    '{servicos,ligadura_hemorroidas,tipo_agendamento}',
    '"hora_marcada"'::jsonb
  ),
  '{periodos}',
  (config->'periodos') || '{
    "segunda_consulta_pool": {
      "dias": [1],
      "servicos": ["consulta_proctologica", "retorno_proctologico", "ligadura_hemorroidas"],
      "limite_pacientes": 9,
      "inicio": "07:00",
      "fim": "12:00"
    },
    "quarta_consulta_pool": {
      "dias": [3],
      "servicos": ["consulta_proctologica", "retorno_proctologico", "ligadura_hemorroidas"],
      "limite_pacientes": 8,
      "inicio": "07:00",
      "fim": "12:00"
    },
    "sexta_consulta_pool": {
      "dias": [5],
      "servicos": ["consulta_proctologica", "retorno_proctologico", "ligadura_hemorroidas"],
      "limite_pacientes": 5,
      "inicio": "07:00",
      "fim": "12:00"
    }
  }'::jsonb
),
updated_at = now()
WHERE medico_id = '20046e90-52cf-44d7-9586-748f55884bd2' 
AND ativo = true;

-- Remover mensagem_bloqueio do ligadura_hemorroidas
UPDATE business_rules
SET config = config #- '{servicos,ligadura_hemorroidas,mensagem_bloqueio}'
WHERE medico_id = '20046e90-52cf-44d7-9586-748f55884bd2' 
AND ativo = true;
