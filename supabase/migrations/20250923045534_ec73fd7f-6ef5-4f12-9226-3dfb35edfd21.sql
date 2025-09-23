-- Cadastrar médico e atendimentos da IPADO

-- Buscar o ID do cliente IPADO
DO $$
DECLARE
  ipado_cliente_id UUID;
  dr_pedro_id UUID;
BEGIN
  -- Buscar ID do cliente IPADO
  SELECT id INTO ipado_cliente_id FROM public.clientes WHERE nome = 'IPADO';
  
  IF ipado_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Cliente IPADO não encontrado';
  END IF;

  -- Inserir Dr. Pedro Francisco
  INSERT INTO public.medicos (
    nome,
    especialidade,
    convenios_aceitos,
    idade_minima,
    idade_maxima,
    ativo,
    cliente_id,
    observacoes
  ) VALUES (
    'Dr. Pedro Francisco',
    'Ultrassonografista / Clínico Geral',
    ARRAY['Unimed Nacional', 'Unimed Regional', 'Unimed Intercâmbio', 'Unimed 40%', 'Unimed 20%', 'Medprev', 'Particular'],
    NULL, -- Sem idade mínima
    NULL, -- Sem idade máxima
    true,
    ipado_cliente_id,
    'Especialidades: Ultrassonografista e Clínico Geral'
  ) RETURNING id INTO dr_pedro_id;

  -- Inserir atendimento de Consulta
  INSERT INTO public.atendimentos (
    nome,
    tipo,
    medico_id,
    medico_nome,
    ativo,
    cliente_id
  ) VALUES (
    'Consulta',
    'consulta',
    dr_pedro_id,
    'Dr. Pedro Francisco',
    true,
    ipado_cliente_id
  );

  -- Inserir atendimento de Retorno
  INSERT INTO public.atendimentos (
    nome,
    tipo,
    medico_id,
    medico_nome,
    ativo,
    cliente_id
  ) VALUES (
    'Retorno',
    'retorno',
    dr_pedro_id,
    'Dr. Pedro Francisco',
    true,
    ipado_cliente_id
  );

  RAISE NOTICE 'Dr. Pedro Francisco e atendimentos cadastrados com sucesso para IPADO';
END $$;