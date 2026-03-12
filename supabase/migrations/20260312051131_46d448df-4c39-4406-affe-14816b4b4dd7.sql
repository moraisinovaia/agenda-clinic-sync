-- Corrigir: desconto à vista existe APENAS para consultas, não para exames técnicos
-- Remover valor_particular_avista e valor_monocular_avista dos exames técnicos
UPDATE atendimentos 
SET valor_particular_avista = NULL, valor_monocular_avista = NULL
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' 
AND tipo != 'consulta' 
AND ativo = true;