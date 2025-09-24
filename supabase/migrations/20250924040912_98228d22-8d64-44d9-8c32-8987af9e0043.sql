-- Criar os 3 médicos especializados para Dr. Marcelo D'Carli
INSERT INTO public.medicos (
  id,
  nome,
  especialidade,
  convenios_aceitos,
  ativo,
  cliente_id,
  created_at
) VALUES 
-- Dr. Marcelo D'Carli principal
(
  gen_random_uuid(),
  'Dr. Marcelo D''Carli',
  'Cardiologista',
  ARRAY['HGU', 'UNIMED Intercâmbio', 'Unimed Nacional', 'Unimed Regional', 'Unimed 40%', 'Unimed 20%', 'CASEMBRAPA', 'CASEC', 'MEDPREV', 'MEDCLIN', 'CLINCENTER', 'SEDLAB', 'CLÍNICA VIDA', 'SAÚDE SERTÃO', 'DR EXAME', 'Particular'],
  true,
  (SELECT id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1),
  now()
),
-- MAPA - Dr. Marcelo (especializado)
(
  gen_random_uuid(),
  'MAPA - Dr. Marcelo',
  'Cardiologista - MAPA',
  ARRAY['HGU', 'UNIMED Intercâmbio', 'Unimed Nacional', 'Unimed Regional', 'Unimed 40%', 'Unimed 20%', 'CASEMBRAPA', 'CASEC', 'MEDPREV', 'MEDCLIN', 'CLINCENTER', 'SEDLAB', 'CLÍNICA VIDA', 'SAÚDE SERTÃO', 'DR EXAME', 'Particular'],
  true,
  (SELECT id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1),
  now()
),
-- Teste Ergométrico - Dr. Marcelo (especializado)
(
  gen_random_uuid(),
  'Teste Ergométrico - Dr. Marcelo',
  'Cardiologista - Teste Ergométrico',
  ARRAY['HGU', 'UNIMED Intercâmbio', 'Unimed Nacional', 'Unimed Regional', 'Unimed 40%', 'Unimed 20%', 'CASEMBRAPA', 'CASEC', 'MEDPREV', 'MEDCLIN', 'CLINCENTER', 'SEDLAB', 'CLÍNICA VIDA', 'SAÚDE SERTÃO', 'DR EXAME', 'Particular'],
  true,
  (SELECT id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1),
  now()
);

-- Criar atendimentos para Dr. Marcelo D'Carli (principal)
INSERT INTO public.atendimentos (
  id,
  nome,
  tipo,
  medico_id,
  medico_nome,
  ativo,
  cliente_id,
  created_at
) VALUES 
-- Atendimentos do Dr. Marcelo D'Carli principal
(
  gen_random_uuid(),
  'Consulta Cardiológica',
  'consulta',
  (SELECT id FROM public.medicos WHERE nome = 'Dr. Marcelo D''Carli' AND cliente_id = (SELECT id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1) LIMIT 1),
  'Dr. Marcelo D''Carli',
  true,
  (SELECT id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1),
  now()
),
(
  gen_random_uuid(),
  'Retorno Cardiológico',
  'retorno',
  (SELECT id FROM public.medicos WHERE nome = 'Dr. Marcelo D''Carli' AND cliente_id = (SELECT id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1) LIMIT 1),
  'Dr. Marcelo D''Carli',
  true,
  (SELECT id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1),
  now()
),
(
  gen_random_uuid(),
  'Exame Cardiológico',
  'exame',
  (SELECT id FROM public.medicos WHERE nome = 'Dr. Marcelo D''Carli' AND cliente_id = (SELECT id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1) LIMIT 1),
  'Dr. Marcelo D''Carli',
  true,
  (SELECT id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1),
  now()
),
(
  gen_random_uuid(),
  'MAPA',
  'exame',
  (SELECT id FROM public.medicos WHERE nome = 'Dr. Marcelo D''Carli' AND cliente_id = (SELECT id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1) LIMIT 1),
  'Dr. Marcelo D''Carli',
  true,
  (SELECT id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1),
  now()
),
(
  gen_random_uuid(),
  'Teste Ergométrico',
  'exame',
  (SELECT id FROM public.medicos WHERE nome = 'Dr. Marcelo D''Carli' AND cliente_id = (SELECT id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1) LIMIT 1),
  'Dr. Marcelo D''Carli',
  true,
  (SELECT id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1),
  now()
);

-- Criar atendimento específico para MAPA - Dr. Marcelo
INSERT INTO public.atendimentos (
  id,
  nome,
  tipo,
  medico_id,
  medico_nome,
  ativo,
  cliente_id,
  created_at
) VALUES (
  gen_random_uuid(),
  'MAPA',
  'exame',
  (SELECT id FROM public.medicos WHERE nome = 'MAPA - Dr. Marcelo' AND cliente_id = (SELECT id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1) LIMIT 1),
  'MAPA - Dr. Marcelo',
  true,
  (SELECT id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1),
  now()
);

-- Criar atendimento específico para Teste Ergométrico - Dr. Marcelo
INSERT INTO public.atendimentos (
  id,
  nome,
  tipo,
  medico_id,
  medico_nome,
  ativo,
  cliente_id,
  created_at
) VALUES (
  gen_random_uuid(),
  'Teste Ergométrico',
  'exame',
  (SELECT id FROM public.medicos WHERE nome = 'Teste Ergométrico - Dr. Marcelo' AND cliente_id = (SELECT id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1) LIMIT 1),
  'Teste Ergométrico - Dr. Marcelo',
  true,
  (SELECT id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1),
  now()
);