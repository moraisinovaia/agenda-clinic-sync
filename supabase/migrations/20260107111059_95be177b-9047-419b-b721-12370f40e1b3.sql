-- Corrigir padronização dos tipos de Unimed usando IDs reais dos médicos da EndoGastro
-- Cliente ID: 39e120b4-5fb7-4d6f-9f91-a598a5bbd253

-- Dr. Darcy Muritiba - Substituir COPARTICIPAÇÃO pelos tipos corretos
UPDATE medicos SET convenios_aceitos = ARRAY[
  'BRADESCO', 'POSTAL', 'MINERAÇÃO', 'ASSEFAZ', 'CODEVASF', 'CASSI', 
  'ASFEB', 'COMPESA', 'CASSEB', 'MEDPREV', 'AGENDA VALE', 'PARTICULAR',
  'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED INTERCÂMBIO'
], updated_at = now()
WHERE id = '8f59fe17-4bf9-4134-b7aa-626249966776';

-- Dr. Fábio Drubi - Substituir COPARTICIPAÇÃO pelos tipos corretos
UPDATE medicos SET convenios_aceitos = ARRAY[
  'PARTICULAR', 'MEDPREV', 'AGENDA VALE', 'HGU', 'MED SAÚDE', 'SERTÃO SAÚDE',
  'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED INTERCÂMBIO'
], updated_at = now()
WHERE id = '477006ad-d1e2-47f8-940a-231f873def96';

-- Dr. Pedro Francisco - Substituir COPARTICIPAÇÃO pelos tipos corretos
UPDATE medicos SET convenios_aceitos = ARRAY[
  'POSTAL', 'MINERAÇÃO', 'CAMED', 'ASSEFAZ', 'CASSIC', 'ASFEB', 
  'COMPESA', 'CASSEB', 'FUSEX', 'MEDPREV', 'AGENDA VALE', 'PARTICULAR',
  'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED INTERCÂMBIO'
], updated_at = now()
WHERE id = '4be6af8b-1f81-4fa2-8264-90400fbafff7';

-- Dr. Rivadávio Espínola - Substituir UNIMED genérico pelos 5 tipos
UPDATE medicos SET convenios_aceitos = ARRAY[
  'BRADESCO', 'POSTAL', 'MINERAÇÃO', 'FUSEX', 'CAMED', 'ASSEFAZ', 
  'PARTICULAR', 'AGENDA VALE',
  'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED INTERCÂMBIO'
], updated_at = now()
WHERE id = '55c0597b-0ecc-4ac6-b9e8-168c499ad74f';

-- Dr. Sydney Ribeiro - Substituir Unimed genérico pelos 5 tipos
UPDATE medicos SET convenios_aceitos = ARRAY[
  'BRADESCO', 'POSTAL', 'MINERAÇÃO', 'FACHESF', 'FUSEX', 'CAMED', 
  'ASSEFAZ', 'CODEVASF', 'CASSIC', 'CASSI', 'ASFEB', 'COMPESA', 
  'CASSEB', 'CAPSAÚDE', 'PARTICULAR',
  'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED INTERCÂMBIO'
], updated_at = now()
WHERE id = '5617c20f-5f3d-4e1f-924c-e624a6b8852b';

-- Dra. Jeovana Brandão - Substituir UNIMED genérico pelos 5 tipos
UPDATE medicos SET convenios_aceitos = ARRAY[
  'AGENDA VALE', 'PARTICULAR',
  'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED INTERCÂMBIO'
], updated_at = now()
WHERE id = 'e12528a9-5b88-426f-8ef9-d0213effd886';

-- Dra. Thalita Mariano - Substituir Unimed genérico pelos 5 tipos
UPDATE medicos SET convenios_aceitos = ARRAY[
  'BRADESCO', 'POSTAL', 'MINERAÇÃO', 'FACHESF', 'FUSEX', 'CAMED', 
  'ASSEFAZ', 'CODEVASF', 'CASSIC', 'CASSI', 'ASFEB', 'COMPESA', 
  'CASSEB', 'CAPSAÚDE', 'PARTICULAR',
  'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED INTERCÂMBIO'
], updated_at = now()
WHERE id = 'ab4ac803-51cc-455a-898b-4ad7f1cda137';

-- Dra. Luziane Sabino - Substituir COPARTICIPAÇÃO pelos tipos corretos
UPDATE medicos SET convenios_aceitos = ARRAY[
  'MINERAÇÃO', 'BRADESCO', 'MEDPREV', 'AGENDA VALE', 'PARTICULAR',
  'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED INTERCÂMBIO'
], updated_at = now()
WHERE id = '7902d115-4300-4fa2-8fc0-751594aa5c9c';