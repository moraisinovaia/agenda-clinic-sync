-- Limpar business_rules órfãs que apontam para médicos de outras clínicas
-- Para a iPado (config_id específico), remover regras de médicos que não pertencem ao cliente_id da iPado

DELETE FROM business_rules 
WHERE config_id = '20b48124-ae41-4e54-8a7e-3e236b8b4829'
AND medico_id IN (
  SELECT m.id FROM medicos m 
  WHERE m.cliente_id != '2bfb98b5-ae41-4f96-8ba7-acc797c22054'
);