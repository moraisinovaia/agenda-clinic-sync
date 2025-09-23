-- Criar função RPC robusta para criar usuário teste IPADO
CREATE OR REPLACE FUNCTION public.criar_usuario_teste_ipado()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := '11111111-1111-1111-1111-111111111111';
  v_cliente_ipado_id uuid;
  v_profile_exists boolean := false;
BEGIN
  -- Verificar se já existe um perfil para este usuário
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = v_user_id) INTO v_profile_exists;
  
  IF v_profile_exists THEN
    RETURN json_build_object(
      'success', true,
      'message', 'Usuário teste IPADO já existe',
      'credentials', json_build_object(
        'email', 'teste@ipado.com',
        'password', 'senha123456'
      )
    );
  END IF;

  -- Buscar cliente IPADO
  SELECT id INTO v_cliente_ipado_id 
  FROM public.clientes 
  WHERE nome = 'IPADO' 
  LIMIT 1;
  
  -- Criar cliente IPADO se não existir
  IF v_cliente_ipado_id IS NULL THEN
    INSERT INTO public.clientes (
      nome,
      ativo,
      configuracoes
    ) VALUES (
      'IPADO',
      true,
      '{"tipo": "clinica", "sistema_origem": "manual"}'::jsonb
    ) RETURNING id INTO v_cliente_ipado_id;
  END IF;
  
  -- Criar perfil diretamente (já aprovado)
  INSERT INTO public.profiles (
    user_id,
    nome,
    email,
    role,
    status,
    ativo,
    cliente_id,
    username,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    'Usuário Teste IPADO',
    'teste@ipado.com',
    'recepcionista',
    'aprovado',
    true,
    v_cliente_ipado_id,
    'teste_ipado',
    now(),
    now()
  );
  
  -- Log da criação
  INSERT INTO public.system_logs (
    timestamp, level, message, context, user_id
  ) VALUES (
    now(), 'info', 
    'Usuário teste IPADO criado via RPC',
    'TEST_USER_CREATION',
    v_user_id
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Usuário teste IPADO criado com sucesso',
    'user_id', v_user_id,
    'credentials', json_build_object(
      'email', 'teste@ipado.com',
      'password', 'senha123456'
    )
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Erro interno: ' || SQLERRM
    );
END;
$$;