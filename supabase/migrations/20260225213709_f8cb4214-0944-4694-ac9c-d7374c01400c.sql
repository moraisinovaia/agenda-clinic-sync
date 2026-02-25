
-- Dra. Camila Leite: substituir UNIMED genérico por 5 tipos específicos
UPDATE medicos 
SET convenios_aceitos = ARRAY['UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED INTERCAMBIO', 'UNIMED 20%', 'UNIMED 40%', 'MEDSAUDE', 'MEDCLIN', 'MEDREV', 'CASSI', 'GEAP', 'CPP', 'SAUDE CAIXA', 'MINERAÇÃO', 'CARAÍBA', 'CAMED', 'PARTICULAR'],
    updated_at = now()
WHERE id = 'e61c3063-97aa-408b-b6a7-2dbf56920f08';

-- Dr. Guilherme Lucena: substituir UNIMED genérico por 5 tipos específicos
UPDATE medicos 
SET convenios_aceitos = ARRAY['UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED INTERCAMBIO', 'UNIMED 20%', 'UNIMED 40%', 'MEDSAUDE', 'MEDCLIN', 'CASSI', 'GEAP', 'CPP', 'SAUDE CAIXA', 'MINERAÇÃO', 'CARAÍBA', 'CAMED', 'PARTICULAR', 'DR VISÃO', 'HGU'],
    updated_at = now()
WHERE id = 'f9a5aab1-5ae1-4b9e-8e26-153beb3f88da';
