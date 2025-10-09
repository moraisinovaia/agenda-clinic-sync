
-- Drop das funções existentes
DROP FUNCTION IF EXISTS public.get_pending_users_safe();
DROP FUNCTION IF EXISTS public.get_approved_users_safe();

-- Recriar get_pending_users_safe com filtro por cliente
CREATE FUNCTION public.get_pending_users_safe()
RETURNS TABLE(
  id uuid,
  nome text,
  email text,
  username varchar,
  role text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.nome,
    p.email,
    p.username,
    COALESCE(
      (SELECT ur.role::text 
       FROM public.user_roles ur 
       WHERE ur.user_id = p.user_id 
       LIMIT 1), 
      'user'
    ) as role,
    p.created_at
  FROM public.profiles p
  WHERE p.status = 'pendente'
    AND p.cliente_id = public.get_user_cliente_id()
    AND public.is_admin_safe()
  ORDER BY p.created_at DESC;
$$;

-- Recriar get_approved_users_safe com filtro por cliente
CREATE FUNCTION public.get_approved_users_safe()
RETURNS TABLE(
  id uuid,
  nome text,
  email text,
  username varchar,
  role text,
  status varchar,
  created_at timestamptz,
  data_aprovacao timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.nome,
    p.email,
    p.username,
    COALESCE(
      (SELECT ur.role::text 
       FROM public.user_roles ur 
       WHERE ur.user_id = p.user_id 
       LIMIT 1), 
      'user'
    ) as role,
    p.status,
    p.created_at,
    p.data_aprovacao
  FROM public.profiles p
  WHERE p.status = 'aprovado'
    AND p.cliente_id = public.get_user_cliente_id()
    AND public.is_admin_safe()
  ORDER BY p.created_at DESC;
$$;

-- Log da correção
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info',
  '[FIX] Funções de listagem de usuários atualizadas com filtro por cliente',
  'FUNCTION_CLIENT_FILTER',
  jsonb_build_object(
    'functions', ARRAY['get_pending_users_safe', 'get_approved_users_safe'],
    'reason', 'Adicionar filtro por cliente_id para isolamento correto dos cadastros'
  )
);
