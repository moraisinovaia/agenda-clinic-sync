-- Corrigir convênio do Dr. Max Koki: trocar MED SAÚDE por MED CENTER
UPDATE medicos 
SET convenios_aceitos = ARRAY[
  'PARTICULAR',
  'MEDPREV',
  'AGENDA VALE',
  'DR. EXAMES',
  'CLINCENTER',
  'MED CENTER'
]
WHERE id = '84f434dc-21f6-41a9-962e-9b0722a0e2d4';