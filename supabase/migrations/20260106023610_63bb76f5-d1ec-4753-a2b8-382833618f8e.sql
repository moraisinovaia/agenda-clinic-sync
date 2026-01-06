-- Padronização dos business_rules da ENDOGASTRO
-- Trocar "Consulta Gastroenterologia" pelo serviço correto de cada especialidade

-- 1. Dr. Aristófilo Coelho - Cardiologia
UPDATE business_rules 
SET config = jsonb_set(
  config #- '{servicos,Consulta Gastroenterologia}',
  '{servicos,Consulta Cardiológica}',
  config->'servicos'->'Consulta Gastroenterologia'
)
WHERE id = 'aa224613-09ad-42a9-b23b-421b8dad299b'
AND config->'servicos' ? 'Consulta Gastroenterologia';

-- 2. Dr. Carlos Philliph - Oftalmologia
UPDATE business_rules 
SET config = jsonb_set(
  config #- '{servicos,Consulta Gastroenterologia}',
  '{servicos,Consulta Oftalmológica}',
  config->'servicos'->'Consulta Gastroenterologia'
)
WHERE id = '2643f036-8ded-448f-bc69-05acfaf356a2'
AND config->'servicos' ? 'Consulta Gastroenterologia';

-- 3. Dr. Cláudio Lustosa - Endocrinologia
UPDATE business_rules 
SET config = jsonb_set(
  config #- '{servicos,Consulta Gastroenterologia}',
  '{servicos,Consulta Endocrinológica}',
  config->'servicos'->'Consulta Gastroenterologia'
)
WHERE id = '509fcc0e-a579-4ed6-8217-e1175bedc434'
AND config->'servicos' ? 'Consulta Gastroenterologia';

-- 4. Dr. Darcy Muritiba - Proctologia
UPDATE business_rules 
SET config = jsonb_set(
  config #- '{servicos,Consulta Gastroenterologia}',
  '{servicos,Consulta Proctológica}',
  config->'servicos'->'Consulta Gastroenterologia'
)
WHERE id = '369326b9-7268-42f4-ba7b-fd844e403f2a'
AND config->'servicos' ? 'Consulta Gastroenterologia';

-- 5. Dr. Diego Tomás - Cardiologia
UPDATE business_rules 
SET config = jsonb_set(
  config #- '{servicos,Consulta Gastroenterologia}',
  '{servicos,Consulta Cardiológica}',
  config->'servicos'->'Consulta Gastroenterologia'
)
WHERE id = '1c655060-4ca9-4889-8610-ec2700c98cac'
AND config->'servicos' ? 'Consulta Gastroenterologia';

-- 6. Dr. Edson Moreira - Gastroenterologia (renomear para padrão com acento)
UPDATE business_rules 
SET config = jsonb_set(
  config #- '{servicos,Consulta Gastroenterologia}',
  '{servicos,Consulta Gastroenterológica}',
  config->'servicos'->'Consulta Gastroenterologia'
)
WHERE id = 'a997b7cb-5c60-42ae-9a6c-928b60dde117'
AND config->'servicos' ? 'Consulta Gastroenterologia';

-- 7. Dr. Fábio Drubi - Neurologia
UPDATE business_rules 
SET config = jsonb_set(
  config #- '{servicos,Consulta Gastroenterologia}',
  '{servicos,Consulta Neurológica}',
  config->'servicos'->'Consulta Gastroenterologia'
)
WHERE id = 'b86d3f75-628b-4daf-ae8d-95e52f5fd499'
AND config->'servicos' ? 'Consulta Gastroenterologia';