-- Corrigir funções de aprovação/rejeição que usam coluna 'role' inexistente

-- 1. Atualizar aprovar_usuario
CREATE OR REPLACE FUNCTION public.aprovar_usuario(p_user_id uuid, p_aprovador_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_aprovador_user_id uuid;
BEGIN
  -- Buscar user_id do aprovador
  SELECT user_id INTO v_aprovador_user_id
  FROM public.profiles 
  WHERE id = p_aprovador_id;
  
  -- Verificar se o aprovador é admin usando has_role
  IF NOT public.has_role(v_aprovador_user_id, 'admin'::app_role) THEN
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

  -- Log da aprovação
  INSERT INTO public.system_logs (
    timestamp, level, message, context, data
  ) VALUES (
    now(), 'info', 
    'Usuário aprovado',
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
    RETURN json_build_object(
      'success', false,
      'error', 'Erro interno: ' || SQLERRM
    );
END;
$$;

-- 2. Atualizar rejeitar_usuario
CREATE OR REPLACE FUNCTION public.rejeitar_usuario(p_user_id uuid, p_aprovador_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_aprovador_user_id uuid;
BEGIN
  -- Buscar user_id do aprovador
  SELECT user_id INTO v_aprovador_user_id
  FROM public.profiles 
  WHERE id = p_aprovador_id;
  
  -- Verificar se o aprovador é admin usando has_role
  IF NOT public.has_role(v_aprovador_user_id, 'admin'::app_role) THEN
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

-- 3. Atualizar confirmar_email_usuario_aprovado
CREATE OR REPLACE FUNCTION public.confirmar_email_usuario_aprovado(p_user_email text, p_admin_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_profile_id uuid;
  v_admin_user_id uuid;
BEGIN
  -- Buscar user_id do admin
  SELECT user_id INTO v_admin_user_id
  FROM public.profiles 
  WHERE id = p_admin_id;
  
  -- Verificar se quem está fazendo a ação é admin usando has_role
  IF NOT public.has_role(v_admin_user_id, 'admin'::app_role) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores aprovados podem confirmar emails'
    );
  END IF;

  -- Verificar se o perfil existe
  SELECT id INTO v_profile_id
  FROM public.profiles 
  WHERE email = p_user_email 
  AND status = 'aprovado';

  IF v_profile_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Perfil não encontrado ou não está aprovado'
    );
  END IF;

  -- Retornar sucesso (confirmação real via Edge Function)
  RETURN json_build_object(
    'success', true,
    'message', 'Use a Edge Function user-management para confirmar o email',
    'profile_id', v_profile_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Erro interno: ' || SQLERRM
    );
END;
$$;

-- Log da correção
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info',
  '[FIX] Funções de aprovação corrigidas para usar has_role()',
  'APPROVAL_FUNCTIONS_FIX',
  jsonb_build_object(
    'functions_updated', ARRAY['aprovar_usuario', 'rejeitar_usuario', 'confirmar_email_usuario_aprovado'],
    'fix', 'Substituído verificação de coluna role por has_role()'
  )
);