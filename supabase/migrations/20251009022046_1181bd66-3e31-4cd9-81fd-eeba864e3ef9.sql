-- Atualizar todos os usuários para o cliente IPADO
-- Garantir que todos vejam os mesmos dados

-- Buscar o ID do cliente IPADO
DO $$
DECLARE
  v_ipado_id uuid;
BEGIN
  -- Buscar cliente IPADO
  SELECT id INTO v_ipado_id 
  FROM public.clientes 
  WHERE nome = 'IPADO' 
  LIMIT 1;
  
  -- Se não existe, criar
  IF v_ipado_id IS NULL THEN
    INSERT INTO public.clientes (nome, ativo, configuracoes)
    VALUES ('IPADO', true, '{"tipo": "clinica", "sistema_origem": "automatic"}'::jsonb)
    RETURNING id INTO v_ipado_id;
  END IF;
  
  -- Atualizar TODOS os perfis para o cliente IPADO
  UPDATE public.profiles 
  SET cliente_id = v_ipado_id
  WHERE cliente_id IS NULL OR cliente_id != v_ipado_id;
  
  RAISE NOTICE 'Todos os usuários agora estão associados ao cliente IPADO (%))', v_ipado_id;
END $$;

-- Atualizar função aprovar_usuario para sempre usar cliente IPADO
DROP FUNCTION IF EXISTS public.aprovar_usuario(uuid, uuid);

CREATE OR REPLACE FUNCTION public.aprovar_usuario(
  p_user_id uuid,
  p_aprovador_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_exists boolean;
  v_email text;
  v_is_admin boolean;
  v_aprovador_profile_id uuid;
  v_cliente_ipado_id uuid;
BEGIN
  -- Verificar se aprovador é admin
  SELECT public.has_role(p_aprovador_user_id, 'admin'::app_role) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem aprovar usuários'
    );
  END IF;
  
  -- Buscar o profile.id do aprovador
  SELECT id INTO v_aprovador_profile_id
  FROM public.profiles
  WHERE user_id = p_aprovador_user_id
  LIMIT 1;
  
  IF v_aprovador_profile_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Perfil do aprovador não encontrado'
    );
  END IF;
  
  -- Verificar se o perfil existe
  SELECT EXISTS(
    SELECT 1 FROM public.profiles WHERE user_id = p_user_id
  ) INTO v_profile_exists;
  
  IF NOT v_profile_exists THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Perfil não encontrado'
    );
  END IF;
  
  -- Buscar email do usuário
  SELECT email INTO v_email
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  -- Buscar cliente IPADO (sempre usar IPADO)
  SELECT id INTO v_cliente_ipado_id 
  FROM public.clientes 
  WHERE nome = 'IPADO' 
  LIMIT 1;
  
  IF v_cliente_ipado_id IS NULL THEN
    INSERT INTO public.clientes (nome, ativo, configuracoes)
    VALUES ('IPADO', true, '{"tipo": "clinica", "sistema_origem": "automatic"}'::jsonb)
    RETURNING id INTO v_cliente_ipado_id;
  END IF;
  
  -- Atualizar perfil: aprovar E atribuir cliente_id IPADO
  UPDATE public.profiles 
  SET 
    status = 'aprovado',
    aprovado_por = v_aprovador_profile_id,
    data_aprovacao = now(),
    cliente_id = v_cliente_ipado_id,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Confirmar email no auth.users
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = p_user_id;
  
  -- Log da aprovação
  INSERT INTO public.system_logs (
    timestamp, level, message, context, user_id, data
  ) VALUES (
    now(), 'info',
    format('[SECURITY] Usuário %s aprovado e atribuído ao cliente IPADO', v_email),
    'USER_APPROVAL',
    p_aprovador_user_id,
    jsonb_build_object(
      'approved_user_id', p_user_id,
      'approver_profile_id', v_aprovador_profile_id,
      'cliente_id', v_cliente_ipado_id,
      'email', v_email
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Usuário aprovado com sucesso'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;