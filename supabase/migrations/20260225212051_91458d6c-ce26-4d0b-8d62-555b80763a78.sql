
-- Dra. Camila Leite: substituir UNIMED genérico por 5 tipos específicos
UPDATE medicos 
SET convenios_aceitos = ARRAY['UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED INTERCAMBIO', 'UNIMED 20%', 'UNIMED 40%', 'MEDSAUDE', 'MEDCLIN', 'MEDREV', 'CASSI', 'GEAP', 'CPP', 'SAUDE CAIXA', 'MINERAÇÃO', 'CARAÍBA', 'CAMED', 'PARTICULAR'],
    updated_at = now()
WHERE id = 'e61c3063-4c04-4e4b-a812-1e3e3d4a5f6b'
  AND cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a';

-- Dr. Guilherme Lucena: substituir UNIMED genérico por 5 tipos específicos
UPDATE medicos 
SET convenios_aceitos = ARRAY['UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED INTERCAMBIO', 'UNIMED 20%', 'UNIMED 40%', 'MEDSAUDE', 'MEDCLIN', 'CASSI', 'GEAP', 'CPP', 'SAUDE CAIXA', 'MINERAÇÃO', 'CARAÍBA', 'CAMED', 'PARTICULAR', 'DR VISÃO', 'HGU'],
    updated_at = now()
WHERE id = 'f9a5aab1-1b2c-4d3e-8f4a-5b6c7d8e9f0a'
  AND cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a';
