-- Limpar dados existentes de médicos
DELETE FROM medicos;

-- Inserir todos os médicos com seus convênios aceitos
INSERT INTO medicos (nome, especialidade, convenios_aceitos, ativo, observacoes) VALUES
-- CARDIOLOGISTAS
('Dr. Aristófilo Coelho', 'Cardiologia', ARRAY['Mineração', 'Fusex', 'Particular', 'Medprev', 'Agenda Vale', 'Dr. Exames', 'Clincenter', 'Camed'], true, 'Camed apenas teste ergométrico, Mapa e Holter'),
('Dr. Diego Tomás', 'Cardiologia', ARRAY['Mineração', 'Fusex', 'Particular', 'Medprev', 'Agenda Vale', 'Dr. Exames', 'Clincenter'], true, null),
('Dr. Heverson Alex', 'Cardiologia', ARRAY['Unimed', 'Medprev', 'Agenda Vale', 'Dr. Exames', 'Clincenter', 'Particular'], true, null),
('Dr. Max Koki', 'Cardiologia', ARRAY['Particular', 'Medprev', 'Agenda Vale', 'Dr. Exames', 'Clincenter'], true, null),

-- CLÍNICO GERAL
('Dr. Rivadávio Espínola', 'Clínica Geral', ARRAY['Unimed', 'Bradesco', 'Postal', 'Mineração', 'Fusex', 'Camed', 'Assefaz', 'Particular', 'Agenda Vale'], true, null),

-- ENDOCRINOLOGISTA
('Dr. Cláudio Lustosa', 'Endocrinologia', ARRAY['Particular'], true, 'Apenas particular - não atende convênios'),

-- GASTROENTEROLOGISTAS
('Dr. Edson Moreira', 'Gastroenterologia', ARRAY['Unimed', 'Bradesco', 'Postal', 'Mineração', 'Fusex', 'Camed', 'Assefaz', 'Codevasf', 'Cassic', 'Cassi', 'Asfeb', 'Compesa', 'Casseb', 'CapSaúde', 'Particular', 'Agenda Vale', 'Medprev'], true, 'Fachesf que comece com nº 43 NÃO atende'),
('Dra. Jeovana Brandão', 'Gastroenterologia', ARRAY['Unimed', 'Agenda Vale', 'Particular'], true, null),
('Dra. Juliana Gama', 'Gastroenterologia', ARRAY['Bradesco', 'Mineração', 'Fusex', 'Postal', 'Assefaz', 'Codevasf', 'Cassi', 'Asfeb', 'Compesa', 'Casseb', 'CapSaúde', 'Particular', 'Agenda Vale', 'Medprev'], true, 'Fachesf que comece com nº 43 NÃO atende'),
('Dra. Lara Eline Menezes', 'Gastroenterologia', ARRAY['Bradesco', 'Mineração', 'Fusex', 'Postal', 'Assefaz', 'Codevasf', 'Cassi', 'Asfeb', 'Compesa', 'Casseb', 'CapSaúde', 'Particular', 'Agenda Vale', 'Medprev'], true, 'Fachesf que comece com nº 43 NÃO atende'),
('Dra. Luziane Sabino', 'Gastroenterologia', ARRAY['Particular'], true, 'Apenas particular'),
('Dra. Thalita Mariano', 'Gastroenterologia', ARRAY['Unimed', 'Bradesco', 'Postal', 'Mineração', 'Fusex', 'Camed', 'Assefaz', 'Codevasf', 'Cassic', 'Cassi', 'Asfeb', 'Compesa', 'Casseb', 'CapSaúde', 'Particular'], true, 'Fachesf que comece com nº 43 NÃO atende'),
('Dr. Sydney Ribeiro', 'Gastroenterologia', ARRAY['Unimed', 'Bradesco', 'Postal', 'Mineração', 'Fusex', 'Camed', 'Assefaz', 'Codevasf', 'Cassic', 'Cassi', 'Asfeb', 'Compesa', 'Casseb', 'CapSaúde', 'Particular'], true, 'Fachesf que comece com nº 43 NÃO atende'),

-- NEUROLOGISTA
('Dr. Fábio Drubi', 'Neurologia', ARRAY['Particular', 'Medprev', 'Agenda Vale', 'Unimed', 'HGU', 'Med Saúde'], true, 'Unimed apenas carteiras que começam com 0210'),

-- OUTROS ESPECIALISTAS
('Dra. Vaníria Brandão', 'Nutrição', ARRAY['Medprev', 'Agenda Vale', 'Mineração', 'Codevasf', 'Postal', 'Fusex', 'Particular'], true, 'Mineração: 1 paciente por dia'),
('Dr. Carlos Philliph', 'Oftalmologia', ARRAY['Medprev', 'Agenda Vale', 'Óticas', 'Particular'], true, null),
('Dra. Camila Helena', 'Psicologia', ARRAY['Particular', 'Medprev', 'Agenda Vale'], true, null),
('Dr. Darcy Muritiba', 'Proctologia', ARRAY['Unimed', 'Bradesco', 'Postal', 'Mineração', 'Assefaz', 'Codevasf', 'Cassi', 'Asfeb', 'Compesa', 'Casseb', 'Medprev', 'Agenda Vale', 'Particular'], true, null),
('Dr. Pedro Francisco', 'Ultrassonografia', ARRAY['Postal', 'Mineração', 'Camed', 'Assefaz', 'Cassic', 'Asfeb', 'Compesa', 'Casseb', 'Fusex', 'Unimed', 'Medprev', 'Agenda Vale', 'Particular'], true, null);