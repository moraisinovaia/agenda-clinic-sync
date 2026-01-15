-- Corrigir business_rules Dra. Adriana: Adicionar permite_online e dias_semana

UPDATE business_rules 
SET config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(config,
            '{servicos,Consulta Endocrinológica,permite_online}', 'true'),
            '{servicos,Consulta Endocrinológica,dias_semana}', '[1,2,3,4,5]'),
          '{servicos,Consulta Endocrinológica,tipo}', '"ordem_chegada"'),
        '{servicos,Retorno Endocrinológico,permite_online}', 'true'),
      '{servicos,Retorno Endocrinológico,dias_semana}', '[1,2,3,4,5]'),
    '{servicos,Retorno Endocrinológico,tipo}', '"ordem_chegada"'),
  updated_at = now()
WHERE medico_id = '32d30887-b876-4502-bf04-e55d7fb55b50';