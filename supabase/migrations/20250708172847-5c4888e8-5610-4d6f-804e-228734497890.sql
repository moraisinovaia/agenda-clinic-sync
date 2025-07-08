-- Atualizar convênios dos médicos existentes
UPDATE medicos SET 
  convenios_aceitos = ARRAY['Mineração', 'Fusex', 'Particular', 'Medprev', 'Agenda Vale', 'Dr. Exames', 'Clincenter', 'Camed'],
  observacoes = 'Camed apenas teste ergométrico, Mapa e Holter'
WHERE nome = 'Dr. Aristófilo Coelho';

UPDATE medicos SET 
  convenios_aceitos = ARRAY['Mineração', 'Fusex', 'Particular', 'Medprev', 'Agenda Vale', 'Dr. Exames', 'Clincenter']
WHERE nome = 'Dr. Diego Tomás';

UPDATE medicos SET 
  convenios_aceitos = ARRAY['Unimed', 'Medprev', 'Agenda Vale', 'Dr. Exames', 'Clincenter', 'Particular']
WHERE nome = 'Dr. Heverson Alex';

UPDATE medicos SET 
  convenios_aceitos = ARRAY['Particular', 'Medprev', 'Agenda Vale', 'Dr. Exames', 'Clincenter']
WHERE nome = 'Dr. Max Koki';

UPDATE medicos SET 
  convenios_aceitos = ARRAY['Unimed', 'Bradesco', 'Postal', 'Mineração', 'Fusex', 'Camed', 'Assefaz', 'Particular', 'Agenda Vale']
WHERE nome = 'Dr. Rivadávio Espínola';

UPDATE medicos SET 
  convenios_aceitos = ARRAY['Particular'],
  observacoes = 'Apenas particular - não atende convênios'
WHERE nome = 'Dr. Cláudio Lustosa';

UPDATE medicos SET 
  convenios_aceitos = ARRAY['Unimed', 'Bradesco', 'Postal', 'Mineração', 'Fusex', 'Camed', 'Assefaz', 'Codevasf', 'Cassic', 'Cassi', 'Asfeb', 'Compesa', 'Casseb', 'CapSaúde', 'Particular', 'Agenda Vale', 'Medprev'],
  observacoes = 'Fachesf que comece com nº 43 NÃO atende'
WHERE nome = 'Dr. Edson Moreira';

-- Inserir novos médicos que não existem
INSERT INTO medicos (nome, especialidade, convenios_aceitos, ativo, observacoes) VALUES
('Dra. Jeovana Brandão', 'Gastroenterologia', ARRAY['Unimed', 'Agenda Vale', 'Particular'], true, null),
('Dra. Juliana Gama', 'Gastroenterologia', ARRAY['Bradesco', 'Mineração', 'Fusex', 'Postal', 'Assefaz', 'Codevasf', 'Cassi', 'Asfeb', 'Compesa', 'Casseb', 'CapSaúde', 'Particular', 'Agenda Vale', 'Medprev'], true, 'Fachesf que comece com nº 43 NÃO atende'),
('Dra. Lara Eline Menezes', 'Gastroenterologia', ARRAY['Bradesco', 'Mineração', 'Fusex', 'Postal', 'Assefaz', 'Codevasf', 'Cassi', 'Asfeb', 'Compesa', 'Casseb', 'CapSaúde', 'Particular', 'Agenda Vale', 'Medprev'], true, 'Fachesf que comece com nº 43 NÃO atende'),
('Dra. Luziane Sabino', 'Gastroenterologia', ARRAY['Particular'], true, 'Apenas particular'),
('Dra. Thalita Mariano', 'Gastroenterologia', ARRAY['Unimed', 'Bradesco', 'Postal', 'Mineração', 'Fusex', 'Camed', 'Assefaz', 'Codevasf', 'Cassic', 'Cassi', 'Asfeb', 'Compesa', 'Casseb', 'CapSaúde', 'Particular'], true, 'Fachesf que comece com nº 43 NÃO atende'),
('Dr. Sydney Ribeiro', 'Gastroenterologia', ARRAY['Unimed', 'Bradesco', 'Postal', 'Mineração', 'Fusex', 'Camed', 'Assefaz', 'Codevasf', 'Cassic', 'Cassi', 'Asfeb', 'Compesa', 'Casseb', 'CapSaúde', 'Particular'], true, 'Fachesf que comece com nº 43 NÃO atende'),
('Dr. Fábio Drubi', 'Neurologia', ARRAY['Particular', 'Medprev', 'Agenda Vale', 'Unimed', 'HGU', 'Med Saúde'], true, 'Unimed apenas carteiras que começam com 0210'),
('Dra. Camila Helena', 'Psicologia', ARRAY['Particular', 'Medprev', 'Agenda Vale'], true, null),
('Dr. Darcy Muritiba', 'Proctologia', ARRAY['Unimed', 'Bradesco', 'Postal', 'Mineração', 'Assefaz', 'Codevasf', 'Cassi', 'Asfeb', 'Compesa', 'Casseb', 'Medprev', 'Agenda Vale', 'Particular'], true, null),
('Dr. Pedro Francisco', 'Ultrassonografia', ARRAY['Postal', 'Mineração', 'Camed', 'Assefaz', 'Cassic', 'Asfeb', 'Compesa', 'Casseb', 'Fusex', 'Unimed', 'Medprev', 'Agenda Vale', 'Particular'], true, null);