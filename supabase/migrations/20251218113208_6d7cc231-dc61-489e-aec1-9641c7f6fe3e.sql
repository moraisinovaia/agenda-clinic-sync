-- Remover Teste Ergométrico das business_rules do Dr. Marcelo D'Carli original
-- Mantém apenas Consulta Cardiológica e ECG
UPDATE business_rules 
SET config = jsonb_set(
  config,
  '{servicos}',
  (config->'servicos') - 'Teste Ergométrico'
),
updated_at = now()
WHERE medico_id = '1e110923-50df-46ff-a57a-29d88e372900';