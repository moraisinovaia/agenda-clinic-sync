-- 1. Criar cliente Clínica Orion
INSERT INTO clientes (id, nome, telefone, whatsapp, endereco, ativo)
VALUES (
  'e8f7d6c5-b4a3-4c2d-9e1f-0a1b2c3d4e5f',
  'Clínica Orion',
  '(87) 3024-1274',
  '(87) 98150-0808',
  'Av. Presidente Tancredo Neves, 1019 - Centro, Petrolina-PE',
  true
);

-- 2. Atualizar médicos exclusivos da Orion para novo cliente_id
UPDATE medicos 
SET cliente_id = 'e8f7d6c5-b4a3-4c2d-9e1f-0a1b2c3d4e5f'
WHERE id IN (
  '20046e90-52cf-44d7-9586-748f55884bd2',  -- Dr. Dilson Pereira
  '83a15377-8f41-47ff-ab37-a0cb3f9d0135',  -- Dr. André Ribeiro Costa
  'cdbfc594-d3de-459f-a9c1-a3f29842273e',  -- Dr. Edson Batista
  '380fc7d2-9587-486b-a968-46556dfc7401',  -- Dr. Sydney Ribeiro
  '14e10918-2dca-40f3-a888-05f0ee77f2dd',  -- Dra. Lara Eline
  'fe51b62b-c688-40ab-b9a6-977e3bd13229'   -- Dra. Lívia Barreiros
);

-- 3. Atualizar llm_clinic_config da Orion para novo cliente_id
UPDATE llm_clinic_config 
SET cliente_id = 'e8f7d6c5-b4a3-4c2d-9e1f-0a1b2c3d4e5f'
WHERE id = '223a7ffd-337b-4379-95b6-85bed89e47d0';

-- 4. Atualizar atendimentos dos médicos da Orion para novo cliente_id
UPDATE atendimentos 
SET cliente_id = 'e8f7d6c5-b4a3-4c2d-9e1f-0a1b2c3d4e5f'
WHERE medico_id IN (
  '20046e90-52cf-44d7-9586-748f55884bd2',
  '83a15377-8f41-47ff-ab37-a0cb3f9d0135',
  'cdbfc594-d3de-459f-a9c1-a3f29842273e',
  '380fc7d2-9587-486b-a968-46556dfc7401',
  '14e10918-2dca-40f3-a888-05f0ee77f2dd',
  'fe51b62b-c688-40ab-b9a6-977e3bd13229'
);