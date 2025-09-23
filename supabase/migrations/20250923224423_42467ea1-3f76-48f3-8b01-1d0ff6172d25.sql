-- Corrigir funções RPC para o sistema de aprovação de usuários
-- O problema é que as funções esperam user_id mas recebem profile.id

-- Log da operação
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info', 
  'Corrigindo funções RPC para aprovação de usuários - problema user_id vs profile_id',
  'FIX_USER_APPROVAL_FUNCTIONS',
  jsonb_build_object(
    'issue', 'functions_expecting_user_id_receiving_profile_id',
    'functions_affected', ARRAY['aprovar_usuario', 'rejeitar_usuario', 'confirmar_email_usuario_aprovado']
  )
);

-- 1. Corrigir função aprovar_usuario
CREATE OR REPLACE FUNCTION public.aprovar_usuario(
  p_user_id uuid,  -- Este é na verdade o profile.id (não user_id)
  p_aprovador_id uuid  -- Este também é profile.id do aprovador
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_exists boolean;
  v_aprovador_is_admin boolean;
BEGIN
  -- Verificar se o profile existe e está pendente
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_user_id AND status = 'pendente'
  ) INTO v_profile_exists;

  IF NOT v_profile_exists THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado ou não está pendente'
    );
  END IF;

  -- Verificar se quem está aprovando é admin
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_aprovador_id 
    AND role = 'admin' 
    AND status = 'aprovado'
  ) INTO v_aprovador_is_admin;

  IF NOT v_aprovador_is_admin THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem aprovar usuários'
    );
  END IF;

  -- Aprovar o usuário
  UPDATE public.profiles 
  SET 
    status = 'aprovado',
    aprovado_por = p_aprovador_id,
    data_aprovacao = now()
  WHERE id = p_user_id;

  -- Confirmar email automaticamente na tabela auth.users
  UPDATE auth.users 
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = (
    SELECT user_id FROM public.profiles WHERE id = p_user_id
  );

  -- Log da aprovação
  INSERT INTO public.system_logs (
    timestamp, level, message, context, data
  ) VALUES (
    now(), 'info', 
    'Usuário aprovado com sucesso',
    'USER_APPROVAL',
    jsonb_build_object(
      'profile_id_aprovado', p_user_id,
      'aprovado_por_profile_id', p_aprovador_id
    )
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário aprovado com sucesso'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro
    INSERT INTO public.system_logs (
      timestamp, level, message, context, data
    ) VALUES (
      now(), 'error', 
      'Erro na função aprovar_usuario: ' || SQLERRM,
      'USER_APPROVAL_ERROR',
      jsonb_build_object(
        'profile_id', p_user_id,
        'aprovador_id', p_aprovador_id,
        'error', SQLERRM
      )
    );

    RETURN json_build_object(
      'success', false,
      'error', 'Erro interno: ' || SQLERRM
    );
END;
$$;

-- 2. Corrigir função rejeitar_usuario
CREATE OR REPLACE FUNCTION public.rejeitar_usuario(
  p_user_id uuid,  -- Este é na verdade o profile.id
  p_aprovador_id uuid  -- Este também é profile.id do aprovador
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se quem está rejeitando é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_aprovador_id 
    AND role = 'admin' 
    AND status = 'aprovado'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem rejeitar usuários'
    );
  END IF;

  -- Rejeitar o usuário
  UPDATE public.profiles 
  SET 
    status = 'rejeitado',
    aprovado_por = p_aprovador_id,
    data_aprovacao = now()
  WHERE id = p_user_id;

  -- Log da rejeição
  INSERT INTO public.system_logs (
    timestamp, level, message, context, data
  ) VALUES (
    now(), 'info', 
    'Usuário rejeitado',
    'USER_REJECTION',
    jsonb_build_object(
      'profile_id_rejeitado', p_user_id,
      'rejeitado_por_profile_id', p_aprovador_id
    )
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário rejeitado'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Erro interno: ' || SQLERRM
    );
END;
$$;

-- 3. Corrigir função confirmar_email_usuario_aprovado
CREATE OR REPLACE FUNCTION public.confirmar_email_usuario_aprovado(
  p_user_email text,
  p_admin_id uuid  -- Este é profile.id do admin
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se quem está confirmando é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_admin_id 
    AND role = 'admin' 
    AND status = 'aprovado'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem confirmar emails'
    );
  END IF;

  -- Verificar se o usuário está aprovado
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE email = p_user_email 
    AND status = 'aprovado'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário deve estar aprovado antes de confirmar email'
    );
  END IF;

  -- Confirmar o email
  UPDATE auth.users 
  SET email_confirmed_at = now()
  WHERE email = p_user_email AND email_confirmed_at IS NULL;

  IF FOUND THEN
    -- Log da confirmação
    INSERT INTO public.system_logs (
      timestamp, level, message, context, data
    ) VALUES (
      now(), 'info', 
      'Email confirmado por admin',
      'EMAIL_CONFIRMATION',
      jsonb_build_object(
        'user_email', p_user_email,
        'confirmado_por_profile_id', p_admin_id
      )
    );

    RETURN json_build_object(
      'success', true,
      'message', 'Email confirmado com sucesso'
    );
  ELSE
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado ou email já confirmado'
    );
  END IF;
END;
$$;