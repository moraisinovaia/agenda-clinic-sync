
-- Adicionar campos de contagem expandida para Dr. Pedro Francisco (Consulta e Retorno)
UPDATE business_rules 
SET config = jsonb_set(
  jsonb_set(
    config,
    '{servicos,Consulta,periodos,manha,contagem_inicio}',
    '"08:00"'
  ),
  '{servicos,Consulta,periodos,manha,contagem_fim}',
  '"12:00"'
),
updated_at = now()
WHERE medico_id = '66e9310d-34cd-4005-8937-74e87125dc03' AND ativo = true;

-- Adicionar para Retorno também (compartilha limite com Consulta)
UPDATE business_rules 
SET config = jsonb_set(
  jsonb_set(
    config,
    '{servicos,Retorno,periodos,manha,contagem_inicio}',
    '"08:00"'
  ),
  '{servicos,Retorno,periodos,manha,contagem_fim}',
  '"12:00"'
),
updated_at = now()
WHERE medico_id = '66e9310d-34cd-4005-8937-74e87125dc03' AND ativo = true;

-- Adicionar campos de contagem expandida para Dr. Alessandro Dias (Ecocardiograma)
UPDATE business_rules 
SET config = jsonb_set(
  jsonb_set(
    config,
    '{servicos,Ecocardiograma,periodos,manha,contagem_inicio}',
    '"07:00"'
  ),
  '{servicos,Ecocardiograma,periodos,manha,contagem_fim}',
  '"12:00"'
),
updated_at = now()
WHERE medico_id = 'c192e08e-e216-4c22-99bf-b5992ce05e17' AND ativo = true;
