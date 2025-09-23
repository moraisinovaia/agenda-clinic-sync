-- Inserir alguns dados de exemplo para o IPADO (similar ao INOVAIA)
-- Mais alguns médicos para o IPADO
INSERT INTO ipado_medicos (nome, especialidade, ativo, horarios, convenios_aceitos, idade_minima, observacoes)
VALUES 
('Dr. João Silva - IPADO', 'Gastroenterologia', true, 
 '{"segunda": [{"inicio": "08:00", "fim": "12:00", "tipo": "consulta", "vagas": 8}], "terca": [{"inicio": "14:00", "fim": "18:00", "tipo": "exame", "vagas": 6}]}',
 ARRAY['Particular', 'Unimed', 'Bradesco'], 18,
 'Atendimento especializado em gastroenterologia - IPADO'),
('Dra. Maria Santos - IPADO', 'Cardiologia', true,
 '{"quarta": [{"inicio": "07:00", "fim": "11:00", "tipo": "consulta", "vagas": 10}], "quinta": [{"inicio": "13:00", "fim": "17:00", "tipo": "exame", "vagas": 5}]}',
 ARRAY['Particular', 'Unimed', 'Cassi'], 16,
 'Especialista em cardiologia - IPADO')
ON CONFLICT DO NOTHING;

-- Atendimentos para o IPADO
INSERT INTO ipado_atendimentos (nome, tipo, ativo, medico_nome, valor_particular, forma_pagamento, observacoes)
VALUES 
('Consulta Gastroenterologia - IPADO', 'consulta', true, 'Dr. João Silva - IPADO', 350.00, 'dinheiro, pix, cartão', 'Consulta especializada IPADO'),
('Exame Cardiológico - IPADO', 'exame', true, 'Dra. Maria Santos - IPADO', 450.00, 'dinheiro, pix, cartão', 'Exame completo IPADO'),
('Endoscopia - IPADO', 'exame', true, 'Dr. João Silva - IPADO', 800.00, 'dinheiro, pix, 2x cartão', 'Exame endoscópico IPADO')
ON CONFLICT DO NOTHING;

-- Alguns pacientes de exemplo para o IPADO
INSERT INTO ipado_pacientes (nome_completo, data_nascimento, convenio, telefone, celular)
VALUES 
('CARLOS ALBERTO - IPADO', '1985-03-15', 'Particular', '(11) 3456-7890', '(11) 98765-4321'),
('ANA PAULA SILVA - IPADO', '1990-07-22', 'Unimed', '(11) 2345-6789', '(11) 97654-3210'),
('JOSÉ SANTOS - IPADO', '1978-12-05', 'Bradesco', '(11) 4567-8901', '(11) 96543-2109')
ON CONFLICT DO NOTHING;