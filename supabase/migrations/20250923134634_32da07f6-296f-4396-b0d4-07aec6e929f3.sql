-- Criar usuário teste para IPADO
DO $$
DECLARE
  v_cliente_ipado_id uuid;
  v_test_user_id uuid;
BEGIN
  -- Buscar ID do cliente IPADO
  SELECT id INTO v_cliente_ipado_id 
  FROM public.clientes 
  WHERE nome = 'IPADO';
  
  -- Se não existir o cliente IPADO, criar
  IF v_cliente_ipado_id IS NULL THEN
    INSERT INTO public.clientes (nome, ativo, configuracoes)
    VALUES ('IPADO', true, '{"tipo": "clinica", "sistema_origem": "manual"}'::jsonb)
    RETURNING id INTO v_cliente_ipado_id;
  END IF;
  
  -- Gerar um user_id fixo para o usuário teste
  v_test_user_id := '11111111-1111-1111-1111-111111111111'::uuid;
  
  -- Criar perfil do usuário teste diretamente (sem depender do auth.users)
  INSERT INTO public.profiles (
    id,
    user_id,
    nome,
    email,
    username,
    role,
    status,
    ativo,
    cliente_id,
    aprovado_por,
    data_aprovacao,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_test_user_id,
    'Usuario Teste IPADO',
    'teste@ipado.com',
    'teste_ipado',
    'recepcionista',
    'aprovado',
    true,
    v_cliente_ipado_id,
    v_test_user_id, -- Auto-aprovado
    now(),
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'aprovado',
    cliente_id = v_cliente_ipado_id,
    data_aprovacao = now();
  
  -- Log da criação
  INSERT INTO public.system_logs (
    timestamp, level, message, context, user_id
  ) VALUES (
    now(), 'info', 
    'Usuário teste criado para IPADO: teste@ipado.com',
    'USER_TEST_CREATION',
    v_test_user_id
  );
  
END $$;

-- Criar função especial para login do usuário teste
CREATE OR REPLACE FUNCTION public.get_test_user_ipado()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_data json;
BEGIN
  SELECT json_build_object(
    'user_id', '11111111-1111-1111-1111-111111111111',
    'email', 'teste@ipado.com',
    'password', 'senha123',
    'nome', 'Usuario Teste IPADO',
    'role', 'recepcionista',
    'status', 'aprovado',
    'cliente', 'IPADO'
  ) INTO v_profile_data;
  
  RETURN v_profile_data;
END;
$$;