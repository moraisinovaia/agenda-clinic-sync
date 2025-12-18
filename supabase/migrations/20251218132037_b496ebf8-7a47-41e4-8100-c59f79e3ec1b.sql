-- Remover constraint antiga que não considera medico_id
DROP INDEX IF EXISTS atendimentos_unique_nome_tipo_cliente;

-- Criar nova constraint que permite mesmo serviço para diferentes médicos
CREATE UNIQUE INDEX atendimentos_unique_nome_tipo_cliente_medico 
ON public.atendimentos (lower(nome::text), lower(tipo::text), cliente_id, COALESCE(medico_id, '00000000-0000-0000-0000-000000000000'::uuid))
WHERE ativo = true;

-- Agora criar Colonoscopia vinculado ao Dr. Sydney Ribeiro
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
  'Colonoscopia',
  'exame',
  true
);

-- Criar Retossigmoidoscopia vinculado ao Dr. Sydney Ribeiro
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
  'Retossigmoidoscopia',
  'exame',
  true
);