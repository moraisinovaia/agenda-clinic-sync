
-- Restaurar limite original do Dr. Pedro Francisco (de 8 para 4)
UPDATE business_rules 
SET config = jsonb_set(
  config,
  '{servicos,Consulta,periodos,manha,limite}',
  '4'::jsonb
),
updated_at = now()
WHERE medico_id = '66e9310d-34cd-4005-8937-74e87125dc03';
