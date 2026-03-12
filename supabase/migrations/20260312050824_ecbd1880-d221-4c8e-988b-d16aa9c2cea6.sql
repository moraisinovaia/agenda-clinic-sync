
-- Adicionar colunas de preço à vista e monocular na tabela atendimentos
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS valor_particular_avista numeric;
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS valor_monocular numeric;
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS valor_monocular_avista numeric;

-- Popular os valores para Clínica Olhos (d7d7b7cf-4ec0-437b-8377-d7555fc5ee6a)

-- Consulta (0501): R$290 parcelado, R$270 à vista (somente binocular)
UPDATE atendimentos SET valor_particular_avista = 270.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND ativo = true
AND nome IN ('Consulta Completa Eletiva', 'Consulta Acuidade Visual - Laudo Concurso', 
'Consulta Acuidade Visual (Laudo Concurso)', 'Consulta Diabetes Mellitus',
'Avaliação Refrativa', 'Teste de Lentes de Contato', 'Teste do Olhinho',
'Tratamento Ceratocone', 'Tratamento Retina', 'Tratamento Uveíte');

-- Tonometria (7619): Bino 80/60, Mono 40/30
UPDATE atendimentos SET valor_particular_avista = 60.00, valor_monocular = 40.00, valor_monocular_avista = 30.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Tonometria' AND ativo = true;

-- Gonioscopia (7621): Bino 140/120, Mono 70/60
UPDATE atendimentos SET valor_particular_avista = 120.00, valor_monocular = 70.00, valor_monocular_avista = 60.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Gonioscopia' AND ativo = true;

-- Curva Tensional (7622): Bino 180/160, Mono 90/80
UPDATE atendimentos SET valor_particular_avista = 160.00, valor_monocular = 90.00, valor_monocular_avista = 80.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Curva Tensional' AND ativo = true;

-- USG (7623): Bino 480/440, Mono 240/220
UPDATE atendimentos SET valor_particular_avista = 440.00, valor_monocular = 240.00, valor_monocular_avista = 220.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Ultrassonografia do Globo Ocular' AND ativo = true;

-- Mapeamento/Campimetria/Paquimetria (7624): Bino 280/260, Mono 140/130
UPDATE atendimentos SET valor_particular_avista = 260.00, valor_monocular = 140.00, valor_monocular_avista = 130.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND ativo = true
AND nome IN ('Mapeamento de Retina', 'Campimetria Computadorizada', 'Paquimetria Ultrassônica');

-- Ceratoscopia/Microscopia/Biometria (7626): Bino 280/260, Mono 140/130
UPDATE atendimentos SET valor_particular_avista = 260.00, valor_monocular = 140.00, valor_monocular_avista = 130.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND ativo = true
AND nome IN ('Ceratoscopia / Topografia de Córnea', 'Microscopia Especular', 'Biometria Ultrassônica');

-- Retinografia (7620): Bino 320/300, Mono 160/150
UPDATE atendimentos SET valor_particular_avista = 300.00, valor_monocular = 160.00, valor_monocular_avista = 150.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Retinografia Colorida' AND ativo = true;

-- OCT (7625): Bino 480/440, Mono 240/220
UPDATE atendimentos SET valor_particular_avista = 440.00, valor_monocular = 240.00, valor_monocular_avista = 220.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'OCT - Tomografia de Coerência Óptica' AND ativo = true;

-- Fotocoagulação/YAG Laser (7628): Bino 1040/960, Mono 520/480
UPDATE atendimentos SET valor_particular_avista = 960.00, valor_monocular = 520.00, valor_monocular_avista = 480.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND ativo = true
AND (nome = 'Fotocoagulação a Laser' OR nome ILIKE 'YAG Laser%' OR nome ILIKE 'Yag Laser%');

-- Epilação de Cílios (7630): Bino 960/860, Mono 480/430
UPDATE atendimentos SET valor_particular_avista = 860.00, valor_monocular = 480.00, valor_monocular_avista = 430.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Epilação de Cílios' AND ativo = true;

-- Pentacam (7631): Bino 560/520, Mono 280/260
UPDATE atendimentos SET valor_particular_avista = 520.00, valor_monocular = 280.00, valor_monocular_avista = 260.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Pentacam' AND ativo = true;
