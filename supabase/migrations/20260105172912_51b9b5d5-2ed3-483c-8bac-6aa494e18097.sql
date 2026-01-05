
-- Inserir APENAS tipos de atendimento para Dr. Edson Batista (IPADO)
-- Sem horarios_configuracao para evitar trigger recursivo
INSERT INTO atendimentos (cliente_id, medico_id, nome, tipo, ativo, horarios, observacoes)
VALUES 
(
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
  'cdbfc594-d3de-459f-a9c1-a3f29842273e',
  'Endoscopia',
  'exame',
  true,
  '{"terça": {"inicio": "08:00", "fim": "09:00"}}',
  'Atendimento por ordem de chegada. Chegada às 08:00.'
),
(
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
  'cdbfc594-d3de-459f-a9c1-a3f29842273e',
  'Consulta',
  'consulta',
  true,
  '{"terça": {"inicio": "09:30", "fim": "10:00"}}',
  'Atendimento por ordem de chegada, inicia após término dos exames.'
),
(
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
  'cdbfc594-d3de-459f-a9c1-a3f29842273e',
  'Retorno',
  'retorno',
  true,
  '{"terça": {"inicio": "09:30", "fim": "10:00"}}',
  'Atendimento por ordem de chegada, inicia após término dos exames.'
);
