
-- Atualizar coparticipação UNIMED e códigos TUSS para Clínica Olhos
-- cliente_id: d7d7b7cf-4ec0-437b-8377-d7555fc5ee6a

-- Consulta Completa Eletiva (consulta + mapeamento + tonometria + gonioscopia = 40/80)
UPDATE atendimentos SET coparticipacao_unimed_20 = 40.00, coparticipacao_unimed_40 = 80.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Consulta Completa Eletiva' AND ativo = true;

-- Consulta Acuidade Visual (somente consulta = 26/52)
UPDATE atendimentos SET coparticipacao_unimed_20 = 26.00, coparticipacao_unimed_40 = 52.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome ILIKE 'Consulta Acuidade Visual%' AND ativo = true;

-- Consulta Diabetes Mellitus (consulta completa = 40/80)
UPDATE atendimentos SET coparticipacao_unimed_20 = 40.00, coparticipacao_unimed_40 = 80.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Consulta Diabetes Mellitus' AND ativo = true;

-- Avaliação Refrativa (somente consulta = 26/52)
UPDATE atendimentos SET coparticipacao_unimed_20 = 26.00, coparticipacao_unimed_40 = 52.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Avaliação Refrativa' AND ativo = true;

-- Curva Tensional - código 41301129
UPDATE atendimentos SET coparticipacao_unimed_20 = 11.00, coparticipacao_unimed_40 = 22.00, codigo = '41301129'
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Curva Tensional' AND ativo = true;

-- Gonioscopia - código 41301242
UPDATE atendimentos SET coparticipacao_unimed_20 = 6.25, coparticipacao_unimed_40 = 12.50, codigo = '41301242'
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Gonioscopia' AND ativo = true;

-- Mapeamento de Retina - código 41301250
UPDATE atendimentos SET coparticipacao_unimed_20 = 12.50, coparticipacao_unimed_40 = 22.00, codigo = '41301250'
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Mapeamento de Retina' AND ativo = true;

-- Ultrassonografia do Globo Ocular - código 40901017
UPDATE atendimentos SET coparticipacao_unimed_20 = 16.00, coparticipacao_unimed_40 = 32.00, codigo = '40901017'
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Ultrassonografia do Globo Ocular' AND ativo = true;

-- Fotocoagulação a Laser - código 30312043
UPDATE atendimentos SET coparticipacao_unimed_20 = 84.00, coparticipacao_unimed_40 = 168.00, codigo = '30312043'
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Fotocoagulação a Laser' AND ativo = true;

-- Retinografia (se existir como exame técnico separado)
UPDATE atendimentos SET coparticipacao_unimed_20 = 9.50, coparticipacao_unimed_40 = 19.00, codigo = '41301315'
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome ILIKE 'Retinografia%' AND ativo = true;

-- YAG Laser / Capsulotomia / Iridotomia - código 30306019
UPDATE atendimentos SET coparticipacao_unimed_20 = 84.00, coparticipacao_unimed_40 = 168.00, codigo = '30306019'
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND (nome ILIKE 'YAG Laser%' OR nome ILIKE 'Yag Laser%') AND ativo = true;

-- Teste do Olhinho (somente consulta = 26/52)
UPDATE atendimentos SET coparticipacao_unimed_20 = 26.00, coparticipacao_unimed_40 = 52.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Teste do Olhinho' AND ativo = true;

-- Teste de Lentes de Contato (somente consulta = 26/52)
UPDATE atendimentos SET coparticipacao_unimed_20 = 26.00, coparticipacao_unimed_40 = 52.00
WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a' AND nome = 'Teste de Lentes de Contato' AND ativo = true;
