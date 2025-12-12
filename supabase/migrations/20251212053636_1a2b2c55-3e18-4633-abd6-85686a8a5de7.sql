-- Corrigir convênio do Dr. Diego Tomás: trocar MED SAÚDE por MED CENTER
UPDATE medicos 
SET convenios_aceitos = ARRAY[
  'MINERAÇÃO',
  'FUSEX',
  'PARTICULAR',
  'MEDPREV',
  'AGENDA VALE',
  'DR. EXAMES',
  'CLINCENTER',
  'MED CENTER'
]
WHERE id = '04505052-89c5-4090-9921-806a6fc7b544';