-- Modificar função de aprovação para confirmar email automaticamente
-- Usuários aprovados não precisam mais verificar email manualmente

DROP FUNCTION IF EXISTS public.aprovar_usuario(uuid, uuid);

CREATE OR REPLACE FUNCTION public.aprovar_usuario(
  p_user_id uuid,
  p_aprovador_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_profile_id uuid;
  v_auth_user_id uuid;
  v_nome text;
  v_email text;
BEGIN
  -- Verificar se quem está aprovando é admin
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem aprovar usuários'
    );
  END IF;

  -- Buscar dados do profile e auth user
  SELECT p.id, p.user_id, p.nome, p.email
  INTO v_profile_id, v_auth_user_id, v_nome, v_email
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_profile_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;

  -- Atualizar status do perfil para aprovado
  UPDATE public.profiles
  SET 
    status = 'aprovado',
    aprovado_por = p_aprovador_id,
    data_aprovacao = now(),
    updated_at = now()
  WHERE id = v_profile_id;

  -- IMPORTANTE: Confirmar email automaticamente no auth.users
  -- Isso permite login imediato sem verificação de email
  UPDATE auth.users
  SET 
    email_confirmed_at = now(),
    updated_at = now()
  WHERE id = v_auth_user_id
  AND email_confirmed_at IS NULL;

  -- Atribuir role de usuário
  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (v_auth_user_id, 'user', p_aprovador_id)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Log da aprovação
  INSERT INTO public.system_logs (
    timestamp, level, message, context, user_id, data
  ) VALUES (
    now(), 'info',
    format('Usuário %s aprovado e email confirmado automaticamente', v_nome),
    'USER_APPROVAL',
    v_auth_user_id,
    jsonb_build_object(
      'profile_id', v_profile_id,
      'aprovador_id', p_aprovador_id,
      'email', v_email,
      'auto_confirmed', true
    )
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário aprovado com sucesso - pode fazer login imediatamente'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;