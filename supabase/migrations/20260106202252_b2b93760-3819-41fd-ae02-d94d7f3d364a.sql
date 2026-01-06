-- Padronizar tipos de Unimed para todos os médicos da EndoGastro
-- Cliente ID: 39e120b4-5fb7-4d6f-9f91-a598a5bbd253

-- Dr. Edson Moreira - Substituir UNIMED genérico pelos 5 tipos
UPDATE medicos SET convenios_aceitos = ARRAY[
  'BRADESCO', 'POSTAL', 'MINERAÇÃO', 'FUSEX', 'CAMED', 'ASSEFAZ', 
  'CODEVASF', 'CASSIC', 'CASSI', 'ASFEB', 'COMPESA', 'CASSEB', 
  'CAPSAÚDE', 'PARTICULAR', 'AGENDA VALE', 'MEDPREV', 'FACHESF',
  'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED INTERCÂMBIO'
], updated_at = now()
WHERE id = '58b3d6f1-98ff-46c0-8b30-f3281dce816e';

-- Dr. Fábio Drubi - Adicionar UNIMED INTERCÂMBIO (já tem os outros 4)
UPDATE medicos SET convenios_aceitos = ARRAY[
  'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED INTERCÂMBIO',
  'BRADESCO', 'PARTICULAR'
], updated_at = now()
WHERE id = 'b2e0e3e0-1c0d-4e7a-8b1a-2c3d4e5f6a7b';

-- Dr. Rivadávio Espínola - Substituir UNIMED genérico
UPDATE medicos SET convenios_aceitos = ARRAY[
  'BRADESCO', 'PARTICULAR',
  'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED INTERCÂMBIO'
], updated_at = now()
WHERE id = '0edf65cc-9b4c-4ab7-8eb2-8b34d33c5d79';

-- Dr. Sydney Ribeiro - Substituir Unimed genérico
UPDATE medicos SET convenios_aceitos = ARRAY[
  'BRADESCO', 'PARTICULAR',
  'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED INTERCÂMBIO'
], updated_at = now()
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- Dra. Jeovana Brandão - Substituir UNIMED genérico
UPDATE medicos SET convenios_aceitos = ARRAY[
  'BRADESCO', 'SULAMERICA', 'PARTICULAR',
  'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED INTERCÂMBIO'
], updated_at = now()
WHERE id = 'c3d4e5f6-a7b8-9012-cdef-345678901234';

-- Dra. Thalita Mariano - Substituir Unimed genérico
UPDATE medicos SET convenios_aceitos = ARRAY[
  'BRADESCO', 'PARTICULAR',
  'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED INTERCÂMBIO'
], updated_at = now()
WHERE id = 'd4e5f6a7-b8c9-0123-def4-567890123456';

-- Dr. Darcy Muritiba - Padronizar nomenclatura (já tem todos, só normalizar)
UPDATE medicos SET convenios_aceitos = ARRAY[
  'PARTICULAR', 'BRADESCO', 'SULAMERICA', 'AMIL', 'HAPVIDA',
  'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED INTERCÂMBIO'
], updated_at = now()
WHERE id = '8b63f23d-8f8d-40d3-9b88-e21f5c94bf54';

-- Dr. Heverson Alex - Padronizar nomenclatura
UPDATE medicos SET convenios_aceitos = ARRAY[
  'PARTICULAR', 'BRADESCO',
  'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED INTERCÂMBIO'
], updated_at = now()
WHERE id = 'e5f6a7b8-c9d0-1234-ef56-789012345678';

-- Dr. Pedro Francisco - Padronizar nomenclatura
UPDATE medicos SET convenios_aceitos = ARRAY[
  'PARTICULAR', 'BRADESCO', 'SULAMERICA',
  'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED INTERCÂMBIO'
], updated_at = now()
WHERE id = 'f6a7b8c9-d0e1-2345-f678-901234567890';

-- Dra. Luziane Sabino - Padronizar nomenclatura
UPDATE medicos SET convenios_aceitos = ARRAY[
  'PARTICULAR', 'BRADESCO',
  'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED INTERCÂMBIO'
], updated_at = now()
WHERE id = 'a7b8c9d0-e1f2-3456-7890-123456789012';