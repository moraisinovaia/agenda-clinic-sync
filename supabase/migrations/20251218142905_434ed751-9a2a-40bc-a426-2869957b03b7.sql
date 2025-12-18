-- Criar atendimento genérico "Exame" para Dr. Sydney Ribeiro
INSERT INTO public.atendimentos (
  cliente_id,
  medico_id,
  medico_nome,
  nome,
  tipo,
  ativo
) VALUES (
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
  '380fc7d2-9587-486b-a968-46556dfc7401',
  'Dr. Sydney Ribeiro',
  'Exame',
  'exame',
  true
);