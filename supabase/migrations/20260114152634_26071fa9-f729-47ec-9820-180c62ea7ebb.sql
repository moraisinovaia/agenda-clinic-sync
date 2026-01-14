-- Migrar agendamentos dos médicos Orion para o novo cliente_id
UPDATE agendamentos 
SET cliente_id = 'e8f7d6c5-b4a3-4c2d-9e1f-0a1b2c3d4e5f'
WHERE medico_id IN (
  '20046e90-52cf-44d7-9586-748f55884bd2',  -- Dr. Dilson Pereira
  '83a15377-8f41-47ff-ab37-a0cb3f9d0135',  -- Dr. André Ribeiro Costa
  'cdbfc594-d3de-459f-a9c1-a3f29842273e',  -- Dr. Edson Batista
  '380fc7d2-9587-486b-a968-46556dfc7401',  -- Dr. Sydney Ribeiro
  '14e10918-2dca-40f3-a888-05f0ee77f2dd',  -- Dra. Lara Eline
  'fe51b62b-c688-40ab-b9a6-977e3bd13229'   -- Dra. Lívia Barreiros
)
AND cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';

-- Migrar pacientes associados aos agendamentos da Orion
UPDATE pacientes 
SET cliente_id = 'e8f7d6c5-b4a3-4c2d-9e1f-0a1b2c3d4e5f'
WHERE id IN (
  SELECT DISTINCT paciente_id FROM agendamentos 
  WHERE medico_id IN (
    '20046e90-52cf-44d7-9586-748f55884bd2',
    '83a15377-8f41-47ff-ab37-a0cb3f9d0135',
    'cdbfc594-d3de-459f-a9c1-a3f29842273e',
    '380fc7d2-9587-486b-a968-46556dfc7401',
    '14e10918-2dca-40f3-a888-05f0ee77f2dd',
    'fe51b62b-c688-40ab-b9a6-977e3bd13229'
  )
  AND cliente_id = 'e8f7d6c5-b4a3-4c2d-9e1f-0a1b2c3d4e5f'
)
AND cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';

-- Migrar bloqueios de agenda dos médicos Orion
UPDATE bloqueios_agenda 
SET cliente_id = 'e8f7d6c5-b4a3-4c2d-9e1f-0a1b2c3d4e5f'
WHERE medico_id IN (
  '20046e90-52cf-44d7-9586-748f55884bd2',
  '83a15377-8f41-47ff-ab37-a0cb3f9d0135',
  'cdbfc594-d3de-459f-a9c1-a3f29842273e',
  '380fc7d2-9587-486b-a968-46556dfc7401',
  '14e10918-2dca-40f3-a888-05f0ee77f2dd',
  'fe51b62b-c688-40ab-b9a6-977e3bd13229'
)
AND cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';

-- Migrar horários configuração dos médicos Orion
UPDATE horarios_configuracao 
SET cliente_id = 'e8f7d6c5-b4a3-4c2d-9e1f-0a1b2c3d4e5f'
WHERE medico_id IN (
  '20046e90-52cf-44d7-9586-748f55884bd2',
  '83a15377-8f41-47ff-ab37-a0cb3f9d0135',
  'cdbfc594-d3de-459f-a9c1-a3f29842273e',
  '380fc7d2-9587-486b-a968-46556dfc7401',
  '14e10918-2dca-40f3-a888-05f0ee77f2dd',
  'fe51b62b-c688-40ab-b9a6-977e3bd13229'
)
AND cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';

-- Migrar horários vazios dos médicos Orion
UPDATE horarios_vazios 
SET cliente_id = 'e8f7d6c5-b4a3-4c2d-9e1f-0a1b2c3d4e5f'
WHERE medico_id IN (
  '20046e90-52cf-44d7-9586-748f55884bd2',
  '83a15377-8f41-47ff-ab37-a0cb3f9d0135',
  'cdbfc594-d3de-459f-a9c1-a3f29842273e',
  '380fc7d2-9587-486b-a968-46556dfc7401',
  '14e10918-2dca-40f3-a888-05f0ee77f2dd',
  'fe51b62b-c688-40ab-b9a6-977e3bd13229'
)
AND cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';

-- Migrar business_rules para novo cliente_id
UPDATE business_rules 
SET cliente_id = 'e8f7d6c5-b4a3-4c2d-9e1f-0a1b2c3d4e5f'
WHERE config_id = '223a7ffd-337b-4379-95b6-85bed89e47d0'
AND cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';

-- Migrar llm_mensagens para novo cliente_id
UPDATE llm_mensagens 
SET cliente_id = 'e8f7d6c5-b4a3-4c2d-9e1f-0a1b2c3d4e5f'
WHERE config_id = '223a7ffd-337b-4379-95b6-85bed89e47d0'
AND cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';