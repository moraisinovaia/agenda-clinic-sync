-- Corrigir convênios do Dr. Aristófilo Coelho
-- Trocar MED SAÚDE por MED CENTER e remover PARTICULAR duplicado
UPDATE medicos 
SET convenios_aceitos = ARRAY[
  'MINERAÇÃO',
  'FUSEX', 
  'PARTICULAR',
  'MEDPREV',
  'AGENDA VALE',
  'DR.EXAMES',
  'CLINCENTER',
  'MED CENTER',
  'CAMED'
]
WHERE id = 'e4298fe4-1d73-4099-83e0-8581cabb7e96';