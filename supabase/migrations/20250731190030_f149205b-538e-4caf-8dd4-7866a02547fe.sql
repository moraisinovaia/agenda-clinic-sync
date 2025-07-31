-- Adicionar convênios Med Saúde e Sertão Saúde para Dr. Fábio
UPDATE public.medicos 
SET convenios_aceitos = array_append(array_append(convenios_aceitos, 'Med Saúde'), 'Sertão Saúde')
WHERE nome ILIKE '%Fábio%' AND nome ILIKE '%Drubi%';