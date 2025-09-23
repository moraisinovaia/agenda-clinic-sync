-- Cadastrar Dra. Adriana Carla de Sena na IPADO

DO $$
DECLARE
  ipado_cliente_id UUID;
  dra_adriana_id UUID;
BEGIN
  -- Buscar ID do cliente IPADO
  SELECT id INTO ipado_cliente_id FROM public.clientes WHERE nome = 'IPADO';
  
  IF ipado_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Cliente IPADO não encontrado';
  END IF;

  -- Inserir Dra. Adriana Carla de Sena
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
    'Dra. Adriana Carla de Sena',
    'Endocrinologista',
    ARRAY['Unimed Nacional', 'Unimed Regional', 'Unimed Intercâmbio', 'Unimed 40%', 'Unimed 20%', 'Particular'],
    18, -- Atende apenas maiores de 18 anos
    NULL, -- Sem idade máxima
    true,
    ipado_cliente_id,
    'Endocrinologista - Atende apenas adultos (maiores de 18 anos)'
  ) RETURNING id INTO dra_adriana_id;

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
    dra_adriana_id,
    'Dra. Adriana Carla de Sena',
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
    dra_adriana_id,
    'Dra. Adriana Carla de Sena',
    true,
    ipado_cliente_id
  );

  RAISE NOTICE 'Dra. Adriana Carla de Sena cadastrada com sucesso para IPADO';
END $$;