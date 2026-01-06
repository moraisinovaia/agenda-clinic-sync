-- Inserir distribuições faltantes para Dr. Aristófilo

-- MAPA Terça: Dr. Aristófilo (4)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, cliente_id)
SELECT r.id, m.id, 2, 4, 'integral', r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'MAPA' AND m.nome ILIKE '%aristofilo%' AND r.cliente_id = m.cliente_id
ON CONFLICT (recurso_id, medico_id, dia_semana, periodo) DO NOTHING;

-- HOLTER Terça: Dr. Aristófilo (2)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, cliente_id)
SELECT r.id, m.id, 2, 2, 'integral', r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'HOLTER' AND m.nome ILIKE '%aristofilo%' AND r.cliente_id = m.cliente_id
ON CONFLICT (recurso_id, medico_id, dia_semana, periodo) DO NOTHING;

-- ECG Quarta: Dr. Aristófilo (manhã e tarde)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, cliente_id)
SELECT r.id, m.id, 3, 3, 'manha', '08:00'::TIME, r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'ECG' AND m.nome ILIKE '%aristofilo%' AND r.cliente_id = m.cliente_id
ON CONFLICT (recurso_id, medico_id, dia_semana, periodo) DO NOTHING;

INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, cliente_id)
SELECT r.id, m.id, 3, 3, 'tarde', '14:00'::TIME, r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'ECG' AND m.nome ILIKE '%aristofilo%' AND r.cliente_id = m.cliente_id
ON CONFLICT (recurso_id, medico_id, dia_semana, periodo) DO NOTHING;