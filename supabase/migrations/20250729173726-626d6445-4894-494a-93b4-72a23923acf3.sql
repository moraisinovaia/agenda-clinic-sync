-- Atualizar a especialidade das médicas para "Gastroenterologia e Hepatologista"

UPDATE public.medicos 
SET especialidade = 'Gastroenterologia e Hepatologista'
WHERE nome IN ('Dra. Jeovana Brandão', 'Dra. Juliana Gama', 'Dra. Lara Eline Menezes', 'Dra. Luziane Sabino');