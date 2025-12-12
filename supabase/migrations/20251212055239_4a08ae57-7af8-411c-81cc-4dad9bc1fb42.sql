-- Atualizar convênios da Dra. Thalita Mariano (adicionar FACHESF)
UPDATE medicos 
SET convenios_aceitos = ARRAY[
  'BRADESCO',
  'POSTAL', 
  'MINERAÇÃO',
  'FACHESF',
  'FUSEX',
  'CAMED',
  'ASSEFAZ',
  'CODEVASF',
  'CASSIC',
  'CASSI',
  'ASFEB',
  'COMPESA',
  'CASSEB',
  'CAPSAÚDE',
  'PARTICULAR',
  'UNIMED NACIONAL',
  'UNIMED REGIONAL',
  'UNIMED COPARTICIPAÇÃO 40%',
  'UNIMED COPARTICIPAÇÃO 20%',
  'UNIMED INTERCÂMBIO'
],
observacoes = 'Fachesf que comece com nº 43 NÃO atende. TERÇA: Endoscopia 5 pacientes a partir das 8h - Fichas 15min antes (07:00). SÓ ENDOSCOPIAS.'
WHERE id = 'ab4ac803-51cc-455a-898b-4ad7f1cda137';