-- Continuar padronização dos business_rules da ENDOGASTRO (parte 2)

-- 8. Dr. Heverson Alex - Cardiologia
UPDATE business_rules 
SET config = jsonb_set(
  config #- '{servicos,Consulta Gastroenterologia}',
  '{servicos,Consulta Cardiológica}',
  config->'servicos'->'Consulta Gastroenterologia'
)
WHERE id = '5f8e2efd-7955-48eb-89a4-3afbec95bbac'
AND config->'servicos' ? 'Consulta Gastroenterologia';

-- 9. Dr. Max Koki - Cardiologia
UPDATE business_rules 
SET config = jsonb_set(
  config #- '{servicos,Consulta Gastroenterologia}',
  '{servicos,Consulta Cardiológica}',
  config->'servicos'->'Consulta Gastroenterologia'
)
WHERE id = '22fdbb8b-ac75-430c-b5ff-2339663aef86'
AND config->'servicos' ? 'Consulta Gastroenterologia';

-- 10. Dr. Pedro Francisco - Ultrassonografia
UPDATE business_rules 
SET config = jsonb_set(
  config #- '{servicos,Consulta Gastroenterologia}',
  '{servicos,Ultrassonografia}',
  config->'servicos'->'Consulta Gastroenterologia'
)
WHERE id = 'c790ac52-99d8-406a-a667-86327d5c96d3'
AND config->'servicos' ? 'Consulta Gastroenterologia';

-- 11. Dr. Rivadávio Espínola - Clínica Geral
UPDATE business_rules 
SET config = jsonb_set(
  config #- '{servicos,Consulta Gastroenterologia}',
  '{servicos,Consulta Clínica Geral}',
  config->'servicos'->'Consulta Gastroenterologia'
)
WHERE id = 'dfaa2ca4-5fb6-4be5-a13c-a54584120044'
AND config->'servicos' ? 'Consulta Gastroenterologia';

-- 12. Dr. Sydney Ribeiro - Gastroenterologia
UPDATE business_rules 
SET config = jsonb_set(
  config #- '{servicos,Consulta Gastroenterologia}',
  '{servicos,Consulta Gastroenterológica}',
  config->'servicos'->'Consulta Gastroenterologia'
)
WHERE id = '75ab98de-706a-4979-9954-ac335e5c8540'
AND config->'servicos' ? 'Consulta Gastroenterologia';

-- 13. Dra. Camila Helena - Psicologia
UPDATE business_rules 
SET config = jsonb_set(
  config #- '{servicos,Consulta Gastroenterologia}',
  '{servicos,Consulta Psicológica}',
  config->'servicos'->'Consulta Gastroenterologia'
)
WHERE id = '49874da1-1ab7-4b5c-bd23-88d4ec906a21'
AND config->'servicos' ? 'Consulta Gastroenterologia';

-- 14. Dra. Jeovana Brandão - Gastroenterologia e Hepatologista
UPDATE business_rules 
SET config = jsonb_set(
  config #- '{servicos,Consulta Gastroenterologia}',
  '{servicos,Consulta Gastroenterológica e Hepatologia}',
  config->'servicos'->'Consulta Gastroenterologia'
)
WHERE id = 'e3c69a62-f422-4c73-8b9e-70738010bc60'
AND config->'servicos' ? 'Consulta Gastroenterologia';

-- 15. Dra. Juliana Gama - Gastroenterologia e Hepatologista
UPDATE business_rules 
SET config = jsonb_set(
  config #- '{servicos,Consulta Gastroenterologia}',
  '{servicos,Consulta Gastroenterológica e Hepatologia}',
  config->'servicos'->'Consulta Gastroenterologia'
)
WHERE id = '90c51ea1-9879-47ae-a825-a2c857507095'
AND config->'servicos' ? 'Consulta Gastroenterologia';

-- 16. Dra. Lara Eline Menezes - Gastroenterologia e Hepatologista
UPDATE business_rules 
SET config = jsonb_set(
  config #- '{servicos,Consulta Gastroenterologia}',
  '{servicos,Consulta Gastroenterológica e Hepatologia}',
  config->'servicos'->'Consulta Gastroenterologia'
)
WHERE id = '24e0c072-e1fa-4067-bbff-b6ec87e1f598'
AND config->'servicos' ? 'Consulta Gastroenterologia';

-- 17. Dra. Luziane Sabino - Gastroenterologia e Hepatologista
UPDATE business_rules 
SET config = jsonb_set(
  config #- '{servicos,Consulta Gastroenterologia}',
  '{servicos,Consulta Gastroenterológica e Hepatologia}',
  config->'servicos'->'Consulta Gastroenterologia'
)
WHERE id = 'b5cad464-ce8c-4a3d-8a01-cb5b110a1f7b'
AND config->'servicos' ? 'Consulta Gastroenterologia';

-- 18. Dra. Thalita Mariano - Gastroenterologia
UPDATE business_rules 
SET config = jsonb_set(
  config #- '{servicos,Consulta Gastroenterologia}',
  '{servicos,Consulta Gastroenterológica}',
  config->'servicos'->'Consulta Gastroenterologia'
)
WHERE id = 'e04a189f-8ec7-4c1a-9eb0-eebfb00fcf94'
AND config->'servicos' ? 'Consulta Gastroenterologia';

-- 19. Dra. Vaníria Brandão - Nutrição
UPDATE business_rules 
SET config = jsonb_set(
  config #- '{servicos,Consulta Gastroenterologia}',
  '{servicos,Consulta Nutricional}',
  config->'servicos'->'Consulta Gastroenterologia'
)
WHERE id = '0cf38182-80d8-4245-b753-75b0fd326a14'
AND config->'servicos' ? 'Consulta Gastroenterologia';

-- 20. JOANA - Enfermagem
UPDATE business_rules 
SET config = jsonb_set(
  config #- '{servicos,Consulta Gastroenterologia}',
  '{servicos,Atendimento de Enfermagem}',
  config->'servicos'->'Consulta Gastroenterologia'
)
WHERE id = '4be3ca65-6fdb-43f4-bc07-26a26531faf6'
AND config->'servicos' ? 'Consulta Gastroenterologia';

-- 21. LORENA - Enfermagem
UPDATE business_rules 
SET config = jsonb_set(
  config #- '{servicos,Consulta Gastroenterologia}',
  '{servicos,Atendimento de Enfermagem}',
  config->'servicos'->'Consulta Gastroenterologia'
)
WHERE id = 'ee73589f-acae-4edc-a40d-25f7d2b98fce'
AND config->'servicos' ? 'Consulta Gastroenterologia';