-- SOLUÇÃO DEFINITIVA: Corrigir funções de listagem de usuários para admins
-- Problema: Filtro por cliente_id estava ocultando novos cadastros

-- 1. Remover funções antigas
DROP FUNCTION IF EXISTS public.get_pending_users_safe();
DROP FUNCTION IF EXISTS public.get_approved_users_safe();

-- 2. Criar get_pending_users_safe SEM filtro de cliente
-- Admins devem ver TODOS os usuários pendentes, não só da sua clínica
CREATE OR REPLACE FUNCTION public.get_pending_users_safe()
RETURNS TABLE(
  id uuid,
  nome text,
  email text,
  username varchar,
  cargo varchar,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verificar se é admin
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem visualizar usuários pendentes';
  END IF;

  -- Retornar TODOS os usuários pendentes (sem filtro de cliente)
  RETURN QUERY
  SELECT 
    p.id,
    p.nome,
    p.email,
    p.username,
    p.cargo,
    p.created_at
  FROM public.profiles p
  WHERE p.status = 'pendente'
  ORDER BY p.created_at DESC;
  
  -- Log para debug
  INSERT INTO public.system_logs (
    timestamp, level, message, context, data
  ) VALUES (
    now(), 'info',
    '[DEBUG] get_pending_users_safe chamado',
    'USER_LIST_DEBUG',
    jsonb_build_object(
      'admin_user_id', auth.uid(),
      'result_count', (SELECT COUNT(*) FROM public.profiles WHERE status = 'pendente')
    )
  );
END;
$$;

-- 3. Criar get_approved_users_safe SEM filtro de cliente
CREATE OR REPLACE FUNCTION public.get_approved_users_safe()
RETURNS TABLE(
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
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verificar se é admin
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem visualizar usuários aprovados';
  END IF;

  -- Retornar TODOS os usuários aprovados (sem filtro de cliente)
  RETURN QUERY
  SELECT 
    p.id,
    p.nome,
    p.email,
    p.username,
    p.cargo,
    p.status,
    p.created_at,
    p.data_aprovacao
  FROM public.profiles p
  WHERE p.status = 'aprovado'
  ORDER BY p.created_at DESC;
  
  -- Log para debug
  INSERT INTO public.system_logs (
    timestamp, level, message, context, data
  ) VALUES (
    now(), 'info',
    '[DEBUG] get_approved_users_safe chamado',
    'USER_LIST_DEBUG',
    jsonb_build_object(
      'admin_user_id', auth.uid(),
      'result_count', (SELECT COUNT(*) FROM public.profiles WHERE status = 'aprovado')
    )
  );
END;
$$;

-- 4. Verificar e corrigir função is_super_admin se necessário
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid() 
    AND email = 'gabworais@gmail.com'
  );
$$;

-- Log final da correção
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info',
  '[FIX DEFINITIVO] Funções de listagem corrigidas - removido filtro cliente_id',
  'USER_LIST_FIX',
  jsonb_build_object(
    'functions_fixed', ARRAY['get_pending_users_safe', 'get_approved_users_safe'],
    'changes', ARRAY[
      'Removido filtro por cliente_id - admins veem todos os usuários',
      'Adicionados logs de debug para rastreamento',
      'Mantida verificação de permissão admin via has_role'
    ],
    'reason', 'Filtro por cliente estava ocultando novos cadastros'
  )
);