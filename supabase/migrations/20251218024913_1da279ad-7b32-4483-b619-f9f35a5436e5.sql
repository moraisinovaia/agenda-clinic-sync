
-- Alterar limite de vagas do Dr. Pedro Francisco de 4 para 8 (teste de configuração dinâmica)
UPDATE business_rules 
SET config = jsonb_set(
  config,
  '{servicos,Consulta,periodos,manha,limite}',
  '8'::jsonb
),
updated_at = now()
WHERE medico_id = '66e9310d-34cd-4005-8937-74e87125dc03';
