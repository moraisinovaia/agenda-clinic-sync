-- Função para recuperar usuários órfãos (existem em auth.users mas não têm perfil)
CREATE OR REPLACE FUNCTION public.recuperar_usuario_orfao(
  p_email text,
  p_nome text,
  p_role text DEFAULT 'recepcionista',
  p_cliente_id uuid DEFAULT NULL,
  p_admin_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_profile_exists boolean := false;
  v_cliente_ipado_id uuid;
BEGIN
  -- Buscar o user_id no auth.users
  SELECT au.id INTO v_user_id
  FROM auth.users au
  WHERE au.email = p_email;
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado no sistema de autenticação'
    );
  END IF;
  
  -- Verificar se já tem perfil
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = v_user_id) INTO v_profile_exists;
  
  IF v_profile_exists THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário já possui perfil criado'
    );
  END IF;
  
  -- Se não foi fornecido cliente_id, buscar o IPADO como padrão
  IF p_cliente_id IS NULL THEN
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
  ELSE
    v_cliente_ipado_id := p_cliente_id;
  END IF;
  
  -- Confirmar email do usuário no auth
  UPDATE auth.users 
  SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE id = v_user_id;
  
  -- Criar perfil para o usuário órfão
  INSERT INTO public.profiles (
    user_id,
    nome,
    email,
    role,
    status,
    ativo,
    cliente_id,
    aprovado_por,
    data_aprovacao,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_nome,
    p_email,
    p_role,
    'aprovado',
    true,
    v_cliente_ipado_id,
    p_admin_id,
    now(),
    now(),
    now()
  );
  
  -- Log da recuperação
  INSERT INTO public.system_logs (
    timestamp, level, message, context, user_id
  ) VALUES (
    now(), 'info', 
    FORMAT('Usuário órfão recuperado: %s (%s)', p_email, p_nome),
    'USER_RECOVERY',
    p_admin_id
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Usuário órfão recuperado com sucesso',
    'user_id', v_user_id,
    'profile_created', true
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Erro interno: ' || SQLERRM
    );
END;
$$;

-- Função para verificar se um email já existe e seu status
CREATE OR REPLACE FUNCTION public.verificar_status_email(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_profile_exists boolean := false;
  v_email_confirmed boolean := false;
  v_profile_status text;
BEGIN
  -- Buscar usuário no auth.users
  SELECT au.id, (au.email_confirmed_at IS NOT NULL)
  INTO v_user_id, v_email_confirmed
  FROM auth.users au
  WHERE au.email = p_email;
  
  -- Se não existe no auth, pode cadastrar normalmente
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'exists_in_auth', false,
      'has_profile', false,
      'email_confirmed', false,
      'status', 'can_register'
    );
  END IF;
  
  -- Verificar se tem perfil
  SELECT (COUNT(*) > 0), MAX(status)
  INTO v_profile_exists, v_profile_status
  FROM public.profiles
  WHERE user_id = v_user_id;
  
  RETURN json_build_object(
    'exists_in_auth', true,
    'has_profile', v_profile_exists,
    'email_confirmed', v_email_confirmed,
    'profile_status', v_profile_status,
    'user_id', v_user_id,
    'status', CASE 
      WHEN NOT v_profile_exists THEN 'orphaned_user'
      WHEN v_profile_status = 'pendente' THEN 'pending_approval'
      WHEN v_profile_status = 'aprovado' THEN 'approved_user'
      WHEN v_profile_status = 'rejeitado' THEN 'rejected_user'
      ELSE 'unknown_status'
    END
  );
END;
$$;