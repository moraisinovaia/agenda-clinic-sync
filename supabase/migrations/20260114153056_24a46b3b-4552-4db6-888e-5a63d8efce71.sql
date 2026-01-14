-- Migrar recepcionistas para Clínica Orion
UPDATE profiles 
SET cliente_id = 'e8f7d6c5-b4a3-4c2d-9e1f-0a1b2c3d4e5f'
WHERE user_id IN (
  '66f5fc35-fc24-459d-a8e7-35ad9a325cde',  -- AlanaLessa
  '5dc30035-7b9c-47f8-a2d6-54987f8f127a',  -- GABI
  '3f4b88b1-e032-40ac-a3c0-38cce377278f',  -- IRYS
  'db6b1eb1-69d2-4ab7-8759-a79531d1c951'   -- LEDA
)
AND cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';