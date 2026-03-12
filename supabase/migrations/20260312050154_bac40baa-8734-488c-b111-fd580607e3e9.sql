
-- Atualizar valores particulares dos atendimentos existentes
-- Teste de Lentes de Contato e Teste do Olhinho = valor consulta R$ 290,00
UPDATE atendimentos SET valor_particular = 290.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' 
AND nome IN ('Teste de Lentes de Contato', 'Teste do Olhinho') AND ativo = true AND valor_particular IS NULL;

-- Criar exames técnicos que faltam (sem medico_id, são exames de técnico)
-- Retinografia Colorida - R$ 320,00 (parcelado 2x binocular)
INSERT INTO atendimentos (cliente_id, nome, tipo, valor_particular, codigo, observacoes, ativo)
VALUES ('d7d7b7cf-4ec0-437b-8377-d7555fc5ee6a', 'Retinografia Colorida', 'exame_tecnico', 320.00, '7620', 'Binocular: R$320 (2x) / R$300 (à vista). Monocular: R$160 (2x) / R$150 (à vista). Necessita dilatação.', true);

-- OCT - R$ 480,00
INSERT INTO atendimentos (cliente_id, nome, tipo, valor_particular, codigo, observacoes, ativo)
VALUES ('d7d7b7cf-4ec0-437b-8377-d7555fc5ee6a', 'OCT - Tomografia de Coerência Óptica', 'exame_tecnico', 480.00, '7625', 'Binocular: R$480 (2x) / R$440 (à vista). Monocular: R$240 (2x) / R$220 (à vista).', true);

-- Campimetria Computadorizada - R$ 280,00 (agrupado com Mapeamento/Paquimetria)
INSERT INTO atendimentos (cliente_id, nome, tipo, valor_particular, codigo, observacoes, ativo)
VALUES ('d7d7b7cf-4ec0-437b-8377-d7555fc5ee6a', 'Campimetria Computadorizada', 'exame_tecnico', 280.00, '7624', 'Binocular: R$280 (2x) / R$260 (à vista). Monocular: R$140 (2x) / R$130 (à vista).', true);

-- Paquimetria Ultrassônica - R$ 280,00
INSERT INTO atendimentos (cliente_id, nome, tipo, valor_particular, codigo, observacoes, ativo)
VALUES ('d7d7b7cf-4ec0-437b-8377-d7555fc5ee6a', 'Paquimetria Ultrassônica', 'exame_tecnico', 280.00, '7624', 'Binocular: R$280 (2x) / R$260 (à vista). Monocular: R$140 (2x) / R$130 (à vista).', true);

-- Ceratoscopia/Topografia de Córnea - R$ 280,00
INSERT INTO atendimentos (cliente_id, nome, tipo, valor_particular, codigo, observacoes, ativo)
VALUES ('d7d7b7cf-4ec0-437b-8377-d7555fc5ee6a', 'Ceratoscopia / Topografia de Córnea', 'exame_tecnico', 280.00, '7626', 'Binocular: R$280 (2x) / R$260 (à vista). Monocular: R$140 (2x) / R$130 (à vista).', true);

-- Microscopia Especular - R$ 280,00
INSERT INTO atendimentos (cliente_id, nome, tipo, valor_particular, codigo, observacoes, ativo)
VALUES ('d7d7b7cf-4ec0-437b-8377-d7555fc5ee6a', 'Microscopia Especular', 'exame_tecnico', 280.00, '7626', 'Binocular: R$280 (2x) / R$260 (à vista). Monocular: R$140 (2x) / R$130 (à vista).', true);

-- Biometria Ultrassônica - R$ 280,00
INSERT INTO atendimentos (cliente_id, nome, tipo, valor_particular, codigo, observacoes, ativo)
VALUES ('d7d7b7cf-4ec0-437b-8377-d7555fc5ee6a', 'Biometria Ultrassônica', 'exame_tecnico', 280.00, '7626', 'Binocular: R$280 (2x) / R$260 (à vista). Monocular: R$140 (2x) / R$130 (à vista).', true);

-- Pentacam - R$ 560,00
INSERT INTO atendimentos (cliente_id, nome, tipo, valor_particular, codigo, observacoes, ativo)
VALUES ('d7d7b7cf-4ec0-437b-8377-d7555fc5ee6a', 'Pentacam', 'exame_tecnico', 560.00, '7631', 'Binocular: R$560 (2x) / R$520 (à vista). Monocular: R$280 (2x) / R$260 (à vista).', true);

-- Epilação de Cílios - R$ 960,00
INSERT INTO atendimentos (cliente_id, nome, tipo, valor_particular, codigo, observacoes, ativo)
VALUES ('d7d7b7cf-4ec0-437b-8377-d7555fc5ee6a', 'Epilação de Cílios', 'exame_tecnico', 960.00, '7630', 'Binocular: R$960 (2x) / R$860 (à vista). Monocular: R$480 (2x) / R$430 (à vista).', true);

-- Tonometria - R$ 80,00
INSERT INTO atendimentos (cliente_id, nome, tipo, valor_particular, codigo, observacoes, ativo)
VALUES ('d7d7b7cf-4ec0-437b-8377-d7555fc5ee6a', 'Tonometria', 'exame_tecnico', 80.00, '7619', 'Binocular: R$80 (2x) / R$60 (à vista). Monocular: R$40 (2x) / R$30 (à vista).', true);

-- Atualizar coparticipação nos novos exames técnicos (campimetria, paquimetria, topografia, microscopia, biometria, retinografia, OCT, pentacam)
UPDATE atendimentos SET coparticipacao_unimed_20 = 19.00, coparticipacao_unimed_40 = 38.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Campimetria Computadorizada' AND ativo = true;

UPDATE atendimentos SET coparticipacao_unimed_20 = 23.50, coparticipacao_unimed_40 = 47.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Paquimetria Ultrassônica' AND ativo = true;

UPDATE atendimentos SET coparticipacao_unimed_20 = 19.50, coparticipacao_unimed_40 = 39.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Ceratoscopia / Topografia de Córnea' AND ativo = true;

UPDATE atendimentos SET coparticipacao_unimed_20 = 55.00, coparticipacao_unimed_40 = 110.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Microscopia Especular' AND ativo = true;

UPDATE atendimentos SET coparticipacao_unimed_20 = 32.00, coparticipacao_unimed_40 = 64.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Biometria Ultrassônica' AND ativo = true;

UPDATE atendimentos SET coparticipacao_unimed_20 = 9.50, coparticipacao_unimed_40 = 19.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Retinografia Colorida' AND ativo = true;

UPDATE atendimentos SET coparticipacao_unimed_20 = 53.00, coparticipacao_unimed_40 = 106.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'OCT - Tomografia de Coerência Óptica' AND ativo = true;

UPDATE atendimentos SET coparticipacao_unimed_20 = 2.00, coparticipacao_unimed_40 = 4.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Tonometria' AND ativo = true;
