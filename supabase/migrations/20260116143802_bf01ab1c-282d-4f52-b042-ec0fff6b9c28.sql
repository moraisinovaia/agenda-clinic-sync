-- Corrigir convênios do Dr. Dilson Pereira
UPDATE medicos 
SET convenios_aceitos = ARRAY[
  'UNIMED NACIONAL',
  'UNIMED REGIONAL',
  'UNIMED INTERCÂMBIO',
  'UNIMED 40%',
  'UNIMED 20%',
  'PARTICULAR'
]
WHERE nome ILIKE '%dilson%';