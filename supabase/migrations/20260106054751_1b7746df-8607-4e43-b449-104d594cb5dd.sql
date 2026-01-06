-- Inserir distribuições faltantes para Dr. Aristófilo usando ID direto
-- MAPA Terça: Dr. Aristófilo (4)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, cliente_id)
SELECT r.id, 'e4298fe4-1d73-4099-83e0-8581cabb7e96', 2, 4, 'integral', r.cliente_id
FROM recursos_equipamentos r WHERE r.nome = 'MAPA'
ON CONFLICT (recurso_id, medico_id, dia_semana, periodo) DO NOTHING;

-- HOLTER Terça: Dr. Aristófilo (2)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, cliente_id)
SELECT r.id, 'e4298fe4-1d73-4099-83e0-8581cabb7e96', 2, 2, 'integral', r.cliente_id
FROM recursos_equipamentos r WHERE r.nome = 'HOLTER'
ON CONFLICT (recurso_id, medico_id, dia_semana, periodo) DO NOTHING;

-- ECG Quarta manhã: Dr. Aristófilo (3 às 08:00)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, cliente_id)
SELECT r.id, 'e4298fe4-1d73-4099-83e0-8581cabb7e96', 3, 3, 'manha', '08:00'::TIME, r.cliente_id
FROM recursos_equipamentos r WHERE r.nome = 'ECG'
ON CONFLICT (recurso_id, medico_id, dia_semana, periodo) DO NOTHING;

-- ECG Quarta tarde: Dr. Aristófilo (3 às 14:00)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, cliente_id)
SELECT r.id, 'e4298fe4-1d73-4099-83e0-8581cabb7e96', 3, 3, 'tarde', '14:00'::TIME, r.cliente_id
FROM recursos_equipamentos r WHERE r.nome = 'ECG'
ON CONFLICT (recurso_id, medico_id, dia_semana, periodo) DO NOTHING;