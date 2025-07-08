-- Atualizar médicos existentes e inserir novos
-- Primeiro, vamos atualizar os existentes se houver

-- Dr. Aristófilo Coelho
INSERT INTO medicos (nome, especialidade, convenios_aceitos, ativo, observacoes) VALUES
('Dr. Aristófilo Coelho', 'Cardiologia', ARRAY['Mineração', 'Fusex', 'Particular', 'Medprev', 'Agenda Vale', 'Dr. Exames', 'Clincenter', 'Camed'], true, 'Camed apenas teste ergométrico, Mapa e Holter')
ON CONFLICT (nome) DO UPDATE SET
convenios_aceitos = EXCLUDED.convenios_aceitos,
especialidade = EXCLUDED.especialidade,
observacoes = EXCLUDED.observacoes;

-- Dr. Diego Tomás
INSERT INTO medicos (nome, especialidade, convenios_aceitos, ativo, observacoes) VALUES
('Dr. Diego Tomás', 'Cardiologia', ARRAY['Mineração', 'Fusex', 'Particular', 'Medprev', 'Agenda Vale', 'Dr. Exames', 'Clincenter'], true, null)
ON CONFLICT (nome) DO UPDATE SET
convenios_aceitos = EXCLUDED.convenios_aceitos,
especialidade = EXCLUDED.especialidade,
observacoes = EXCLUDED.observacoes;

-- Dr. Heverson Alex
INSERT INTO medicos (nome, especialidade, convenios_aceitos, ativo, observacoes) VALUES
('Dr. Heverson Alex', 'Cardiologia', ARRAY['Unimed', 'Medprev', 'Agenda Vale', 'Dr. Exames', 'Clincenter', 'Particular'], true, null)
ON CONFLICT (nome) DO UPDATE SET
convenios_aceitos = EXCLUDED.convenios_aceitos,
especialidade = EXCLUDED.especialidade,
observacoes = EXCLUDED.observacoes;

-- Dr. Max Koki
INSERT INTO medicos (nome, especialidade, convenios_aceitos, ativo, observacoes) VALUES
('Dr. Max Koki', 'Cardiologia', ARRAY['Particular', 'Medprev', 'Agenda Vale', 'Dr. Exames', 'Clincenter'], true, null)
ON CONFLICT (nome) DO UPDATE SET
convenios_aceitos = EXCLUDED.convenios_aceitos,
especialidade = EXCLUDED.especialidade,
observacoes = EXCLUDED.observacoes;

-- Dr. Rivadávio Espínola
INSERT INTO medicos (nome, especialidade, convenios_aceitos, ativo, observacoes) VALUES
('Dr. Rivadávio Espínola', 'Clínica Geral', ARRAY['Unimed', 'Bradesco', 'Postal', 'Mineração', 'Fusex', 'Camed', 'Assefaz', 'Particular', 'Agenda Vale'], true, null)
ON CONFLICT (nome) DO UPDATE SET
convenios_aceitos = EXCLUDED.convenios_aceitos,
especialidade = EXCLUDED.especialidade,
observacoes = EXCLUDED.observacoes;