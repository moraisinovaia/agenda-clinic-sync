-- Sincronizar dados do Dr. Edson Batista na tabela medicos
UPDATE medicos 
SET 
  idade_minima = 18,
  convenios_aceitos = ARRAY[
    'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED INTERCÂMBIO', 
    'UNIMED 40%', 'UNIMED 20%', 'PARTICULAR', 'SAÚDE BRADESCO', 
    'CASSI', 'CAPSAUDE', 'POSTAL SAÚDE', 'CAMED', 'MINERAÇÃO CARAÍBA', 
    'FACHESF', 'FUSEX', 'ASSEFAZ', 'CODEVASF', 'CASSIC', 'ASFEB', 
    'COMPESA', 'CASSEB'
  ]
WHERE id = 'cdbfc594-d3de-459f-a9c1-a3f29842273e';