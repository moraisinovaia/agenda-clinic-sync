-- 1. DELETAR mensagens antigas da Dra. Adriana
DELETE FROM llm_mensagens 
WHERE medico_id = '32d30887-b876-4502-bf04-e55d7fb55b50';

-- 2. CRIAR nova mensagem de ENCAIXE para Dra. Adriana
INSERT INTO llm_mensagens (cliente_id, medico_id, tipo, mensagem, ativo)
VALUES (
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054', -- IPADO
  '32d30887-b876-4502-bf04-e55d7fb55b50', -- Dra. Adriana
  'encaixe',
  'O(a) paciente pode tentar um encaixe com a Dra. Adriana por ligação normal nesse mesmo número (87) 3866-4050 (não atendemos ligação via whatsapp), de segunda a sexta-feira, às 10:00h, ou nas terças e quartas-feiras, às 14:30h',
  true
);

-- 3. CRIAR nova mensagem de PAGAMENTO para Dra. Adriana
INSERT INTO llm_mensagens (cliente_id, medico_id, tipo, mensagem, ativo)
VALUES (
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054', -- IPADO
  '32d30887-b876-4502-bf04-e55d7fb55b50', -- Dra. Adriana
  'pagamento',
  'O pagamento deve ser apenas em espécie, não aceitando cartão nem pix.',
  true
);

-- 4. CRIAR atendimento "Consulta Endocrinológica"
INSERT INTO atendimentos (cliente_id, nome, tipo, ativo, medico_id, medico_nome)
SELECT 
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
  'Consulta Endocrinológica',
  'consulta',
  true,
  '32d30887-b876-4502-bf04-e55d7fb55b50',
  'Dra. Adriana Carla de Sena'
WHERE NOT EXISTS (
  SELECT 1 FROM atendimentos 
  WHERE cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054'
  AND LOWER(nome) = 'consulta endocrinológica'
  AND ativo = true
);

-- 5. CRIAR atendimento "Retorno Endocrinológico"
INSERT INTO atendimentos (cliente_id, nome, tipo, ativo, medico_id, medico_nome)
SELECT 
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
  'Retorno Endocrinológico',
  'retorno',
  true,
  '32d30887-b876-4502-bf04-e55d7fb55b50',
  'Dra. Adriana Carla de Sena'
WHERE NOT EXISTS (
  SELECT 1 FROM atendimentos 
  WHERE cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054'
  AND LOWER(nome) = 'retorno endocrinológico'
  AND ativo = true
);