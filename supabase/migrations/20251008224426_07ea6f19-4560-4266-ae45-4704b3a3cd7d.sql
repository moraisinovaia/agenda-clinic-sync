-- ============================================
-- CORREÇÃO: Remover acesso a auth.users de funções RPC
-- ============================================
-- Problema: Funções RPC tentam acessar auth.users diretamente (proibido)
-- Solução: Atualizar funções para retornar apenas dados de profiles
--          (acesso a auth.users será feito via Edge Function com Admin API)

-- 1. Dropar e recriar get_approved_users_safe para não acessar auth.users
DROP FUNCTION IF EXISTS public.get_approved_users_safe();

CREATE OR REPLACE FUNCTION public.get_approved_users_safe()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  nome text,
  email text,
  username character varying,
  role text,
  status character varying,
  created_at timestamp with time zone,
  aprovado_por uuid,
  aprovador_nome text,
  data_aprovacao timestamp with time zone,
  ativo boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.user_id,
    p.nome,
    p.email,
    p.username,
    p.role,
    p.status,
    p.created_at,
    p.aprovado_por,
    a.nome as aprovador_nome,
    p.data_aprovacao,
    p.ativo
  FROM public.profiles p
  LEFT JOIN public.profiles a ON p.aprovado_por = a.id
  WHERE p.status = 'aprovado'
    AND p.user_id != auth.uid()
    AND public.is_admin_safe()
  ORDER BY p.created_at DESC;
$$;

-- 2. Dropar e recriar confirmar_email_usuario_aprovado
DROP FUNCTION IF EXISTS public.confirmar_email_usuario_aprovado(text, uuid);

CREATE OR REPLACE FUNCTION public.confirmar_email_usuario_aprovado(
  p_user_email text,
  p_admin_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  -- Verificar se quem está fazendo a ação é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_admin_id 
    AND role = 'admin' 
    AND status = 'aprovado'
  ) THEN
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

-- 3. Dropar e recriar excluir_usuario
DROP FUNCTION IF EXISTS public.excluir_usuario(uuid, uuid);

CREATE OR REPLACE FUNCTION public.excluir_usuario(
  p_user_id uuid,
  p_admin_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_nome text;
  v_user_email text;
BEGIN
  -- Verificar se quem está excluindo é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_admin_id 
    AND role = 'admin' 
    AND status = 'aprovado'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores aprovados podem excluir usuários'
    );
  END IF;

  -- Verificar se o usuário a ser excluído existe
  SELECT nome, email INTO v_user_nome, v_user_email
  FROM public.profiles 
  WHERE id = p_user_id;

  IF v_user_nome IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;

  -- Verificar se não está tentando excluir a si mesmo
  IF p_user_id = p_admin_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Você não pode excluir a si mesmo'
    );
  END IF;

  -- Retornar sucesso (exclusão real via Edge Function)
  RETURN json_build_object(
    'success', true,
    'message', 'Use a Edge Function user-management para excluir o usuário',
    'user_info', json_build_object('nome', v_user_nome, 'email', v_user_email)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Erro interno: ' || SQLERRM
    );
END;
$$;

-- Log da migração
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info',
  '[MIGRATION] Funções RPC atualizadas para não acessar auth.users',
  'RPC_MIGRATION',
  jsonb_build_object(
    'functions_updated', ARRAY['get_approved_users_safe', 'confirmar_email_usuario_aprovado', 'excluir_usuario'],
    'note', 'Acesso a auth.users agora via Edge Function user-management com Admin API'
  )
);
