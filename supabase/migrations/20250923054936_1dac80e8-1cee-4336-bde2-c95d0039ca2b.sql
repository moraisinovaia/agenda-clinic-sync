-- Função para listar usuários órfãos (admin)
CREATE OR REPLACE FUNCTION public.listar_usuarios_orfaos()
RETURNS TABLE (
  email text,
  user_id uuid,
  email_confirmed_at timestamptz,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verificar se o usuário atual é admin aprovado
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND status = 'aprovado'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem listar usuários órfãos';
  END IF;

  -- Retornar usuários que existem em auth.users mas não têm perfil em profiles
  RETURN QUERY
  SELECT 
    au.email,
    au.id as user_id,
    au.email_confirmed_at,
    au.created_at,
    au.last_sign_in_at
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.user_id
  WHERE p.user_id IS NULL
  AND au.email IS NOT NULL
  ORDER BY au.created_at DESC;
END;
$$;

-- Função para criar perfil administrativo para usuário órfão
CREATE OR REPLACE FUNCTION public.criar_perfil_admin_orfao(
  p_user_id uuid,
  p_nome text,
  p_role text DEFAULT 'recepcionista',
  p_admin_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_email text;
  v_profile_exists boolean := false;
  v_cliente_ipado_id uuid;
BEGIN
  -- Verificar se o admin tem permissão
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = COALESCE(p_admin_id, auth.uid())
    AND role = 'admin' 
    AND status = 'aprovado'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Acesso negado: apenas administradores podem criar perfis'
    );
  END IF;

  -- Buscar email do usuário
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = p_user_id;
  
  IF v_user_email IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;
  
  -- Verificar se já tem perfil
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = p_user_id) INTO v_profile_exists;
  
  IF v_profile_exists THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário já possui perfil'
    );
  END IF;
  
  -- Buscar cliente IPADO
  SELECT id INTO v_cliente_ipado_id 
  FROM public.clientes 
  WHERE nome = 'IPADO' 
  LIMIT 1;
  
  IF v_cliente_ipado_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cliente IPADO não encontrado'
    );
  END IF;
  
  -- Confirmar email se necessário
  UPDATE auth.users 
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = p_user_id;
  
  -- Criar perfil
  INSERT INTO public.profiles (
    user_id,
    nome,
    email,
    role,
    status,
    ativo,
    cliente_id,
    aprovado_por,
    data_aprovacao
  ) VALUES (
    p_user_id,
    p_nome,
    v_user_email,
    p_role,
    'aprovado',
    true,
    v_cliente_ipado_id,
    COALESCE(p_admin_id, auth.uid()),
    now()
  );
  
  -- Log da criação
  INSERT INTO public.system_logs (
    timestamp, level, message, context, user_id
  ) VALUES (
    now(), 'info', 
    FORMAT('Perfil criado por admin para usuário órfão: %s (%s)', v_user_email, p_nome),
    'ADMIN_PROFILE_CREATION',
    COALESCE(p_admin_id, auth.uid())
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Perfil criado com sucesso',
    'user_id', p_user_id,
    'email', v_user_email
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Erro interno: ' || SQLERRM
    );
END;
$$;