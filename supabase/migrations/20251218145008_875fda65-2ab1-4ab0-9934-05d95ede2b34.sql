-- Sincronizar convênios do Dr. Sydney Ribeiro no frontend com a LLM API
UPDATE public.medicos 
SET convenios_aceitos = ARRAY[
  'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED INTERCÂMBIO', 
  'UNIMED 40%', 'UNIMED 20%', 'PARTICULAR', 'SAÚDE BRADESCO', 
  'CASSI', 'CAPSAUDE', 'POSTAL SAÚDE', 'CAMED',
  'MINERAÇÃO CARAÍBA', 'FACHESF', 'FUSEX', 'ASSEFAZ', 
  'CODEVASF', 'CASSIC', 'ASFEB', 'COMPESA', 'CASSEB'
]
WHERE id = '380fc7d2-9587-486b-a968-46556dfc7401';