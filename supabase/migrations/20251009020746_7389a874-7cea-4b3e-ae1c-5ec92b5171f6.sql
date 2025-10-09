-- Corrigir função aprovar_usuario para usar profiles.id ao invés de user_id
-- A coluna aprovado_por referencia profiles.id, não user_id

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
BEGIN
  -- Verificar se aprovador é admin usando has_role
  SELECT public.has_role(p_aprovador_user_id, 'admin'::app_role) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem aprovar usuários'
    );
  END IF;
  
  -- Buscar o profile.id do aprovador a partir do user_id
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
  
  -- Verificar se o perfil do usuário a ser aprovado existe
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
  
  -- Atualizar status do perfil para aprovado
  -- IMPORTANTE: aprovado_por agora usa profile.id do aprovador
  UPDATE public.profiles 
  SET 
    status = 'aprovado',
    aprovado_por = v_aprovador_profile_id,
    data_aprovacao = now(),
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Confirmar email automaticamente no auth.users
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = p_user_id;
  
  -- Log da aprovação
  INSERT INTO public.system_logs (
    timestamp, level, message, context, user_id, data
  ) VALUES (
    now(), 'info',
    format('[SECURITY] Usuário %s aprovado', v_email),
    'USER_APPROVAL',
    p_aprovador_user_id,
    jsonb_build_object(
      'approved_user_id', p_user_id,
      'approver_user_id', p_aprovador_user_id,
      'approver_profile_id', v_aprovador_profile_id,
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