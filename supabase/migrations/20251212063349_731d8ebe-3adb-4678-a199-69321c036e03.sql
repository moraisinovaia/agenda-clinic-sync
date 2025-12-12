-- Primeiro, fazer DROP da função existente para poder alterar o retorno
DROP FUNCTION IF EXISTS public.get_approved_users_safe();

-- Recriar get_approved_users_safe com role incluída
CREATE OR REPLACE FUNCTION public.get_approved_users_safe()
RETURNS TABLE(
  id uuid,
  nome text,
  email text,
  username text,
  cargo text,
  status text,
  created_at timestamptz,
  data_aprovacao timestamptz,
  cliente_nome text,
  user_id uuid,
  role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.nome,
    p.email,
    p.username,
    p.cargo,
    p.status,
    p.created_at,
    p.data_aprovacao,
    c.nome as cliente_nome,
    p.user_id,
    COALESCE(
      (SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = p.user_id LIMIT 1),
      'recepcionista'
    ) as role
  FROM public.profiles p
  LEFT JOIN public.clientes c ON c.id = p.cliente_id
  WHERE p.status = 'aprovado'
  ORDER BY p.data_aprovacao DESC NULLS LAST;
$$;