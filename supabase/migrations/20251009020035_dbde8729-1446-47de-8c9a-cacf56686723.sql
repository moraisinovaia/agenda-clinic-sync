-- ========================================
-- CORREÇÃO COMPLETA DO SISTEMA DE APROVAÇÃO
-- ========================================

-- 1. Dropar todas as versões antigas das funções
DROP FUNCTION IF EXISTS public.aprovar_usuario(uuid, uuid);
DROP FUNCTION IF EXISTS public.aprovar_usuario(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.rejeitar_usuario(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_pending_users_safe();
DROP FUNCTION IF EXISTS public.get_approved_users_safe();

-- 2. Criar função aprovar_usuario CORRIGIDA
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
BEGIN
  -- Verificar se aprovador é admin usando has_role
  SELECT public.has_role(p_aprovador_user_id, 'admin'::app_role) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem aprovar usuários'
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
  
  -- Atualizar status do perfil para aprovado
  UPDATE public.profiles 
  SET 
    status = 'aprovado',
    aprovado_por = p_aprovador_user_id,
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

-- 3. Criar função rejeitar_usuario CORRIGIDA
CREATE OR REPLACE FUNCTION public.rejeitar_usuario(
  p_user_id uuid,
  p_aprovador_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Verificar se aprovador é admin
  SELECT public.has_role(p_aprovador_user_id, 'admin'::app_role) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem rejeitar usuários'
    );
  END IF;
  
  -- Atualizar status do perfil para rejeitado
  UPDATE public.profiles 
  SET 
    status = 'rejeitado',
    updated_at = now()
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Usuário rejeitado com sucesso'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 4. Criar get_pending_users_safe CORRIGIDA
CREATE OR REPLACE FUNCTION public.get_pending_users_safe()
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  username varchar,
  cargo varchar,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id as id,
    p.nome,
    p.email,
    p.username,
    p.cargo,
    p.created_at
  FROM public.profiles p
  WHERE p.status = 'pendente'
  ORDER BY p.created_at DESC;
END;
$$;

-- 5. Criar get_approved_users_safe CORRIGIDA
CREATE OR REPLACE FUNCTION public.get_approved_users_safe()
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  username varchar,
  cargo varchar,
  status varchar,
  created_at timestamptz,
  data_aprovacao timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id as id,
    p.nome,
    p.email,
    p.username,
    p.cargo,
    p.status,
    p.created_at,
    p.data_aprovacao
  FROM public.profiles p
  WHERE p.status = 'aprovado'
  ORDER BY p.data_aprovacao DESC NULLS LAST, p.created_at DESC;
END;
$$;

-- 6. Corrigir todos os usuários aprovados que não têm email confirmado
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE id IN (
  SELECT user_id 
  FROM public.profiles 
  WHERE status = 'aprovado'
)
AND email_confirmed_at IS NULL;

-- 7. Log da correção
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info',
  '[FIX] Sistema de aprovação completamente corrigido',
  'USER_APPROVAL_FIX',
  jsonb_build_object(
    'fixed_functions', ARRAY['aprovar_usuario', 'rejeitar_usuario', 'get_pending_users_safe', 'get_approved_users_safe'],
    'fixed_emails', (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at = now()),
    'timestamp', now()
  )
);