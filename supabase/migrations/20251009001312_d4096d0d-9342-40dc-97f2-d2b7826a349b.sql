-- Remover funções existentes primeiro
DROP FUNCTION IF EXISTS public.get_pending_users_safe();
DROP FUNCTION IF EXISTS public.get_approved_users_safe();

-- Criar função is_admin_safe se não existir
CREATE OR REPLACE FUNCTION public.is_admin_safe()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

-- Criar get_pending_users_safe com role de user_roles
CREATE FUNCTION public.get_pending_users_safe()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  nome text,
  email text,
  username varchar,
  role text,
  status varchar,
  created_at timestamptz,
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
    COALESCE(
      (SELECT ur.role::text 
       FROM public.user_roles ur 
       WHERE ur.user_id = p.user_id 
       LIMIT 1), 
      'user'
    ) as role,
    p.status,
    p.created_at,
    p.ativo
  FROM public.profiles p
  WHERE p.status = 'pendente'
    AND public.is_admin_safe()
  ORDER BY p.created_at DESC;
$$;

-- Criar get_approved_users_safe com role de user_roles
CREATE FUNCTION public.get_approved_users_safe()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  nome text,
  email text,
  username varchar,
  role text,
  status varchar,
  created_at timestamptz,
  aprovado_por uuid,
  aprovador_nome text,
  data_aprovacao timestamptz,
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
    COALESCE(
      (SELECT ur.role::text 
       FROM public.user_roles ur 
       WHERE ur.user_id = p.user_id 
       LIMIT 1), 
      'user'
    ) as role,
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