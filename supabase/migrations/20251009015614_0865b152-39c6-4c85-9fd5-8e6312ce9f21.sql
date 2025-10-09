-- Corrigir função aprovar_usuario para não atribuir role aos usuários comuns
-- Apenas admins terão role na tabela user_roles

CREATE OR REPLACE FUNCTION public.aprovar_usuario(
  p_user_id uuid,
  p_aprovador_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_exists boolean;
  v_email text;
BEGIN
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
  
  -- Atualizar status do perfil para aprovado
  UPDATE public.profiles 
  SET 
    status = 'aprovado',
    aprovado_por = p_aprovador_id,
    data_aprovacao = now(),
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Confirmar email automaticamente no auth.users
  UPDATE auth.users
  SET email_confirmed_at = now()
  WHERE id = p_user_id
  AND email_confirmed_at IS NULL;
  
  -- Log da aprovação
  INSERT INTO public.system_logs (
    timestamp, level, message, context, user_id, data
  ) VALUES (
    now(), 'info',
    format('[SECURITY] Usuário %s aprovado', v_email),
    'USER_APPROVAL',
    p_aprovador_id,
    jsonb_build_object(
      'approved_user_id', p_user_id,
      'approver_id', p_aprovador_id,
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