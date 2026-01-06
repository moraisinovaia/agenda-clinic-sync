-- Remover registro duplicado da Dra. Adriana Carla de Sena na ENDOGASTRO
-- Ela trabalha apenas na IPADO

-- 1. Remover business_rule associada
DELETE FROM business_rules 
WHERE id = 'a2e7a57d-d0a9-445f-b5fb-01d0c2cd31ea';

-- 2. Remover registro do médico na ENDOGASTRO
DELETE FROM medicos 
WHERE id = '592ca695-35c6-4e26-9d33-ea3795ab7a25'
  AND cliente_id = '0195e429-a8cb-71c7-b18f-534d09a1ddd4';