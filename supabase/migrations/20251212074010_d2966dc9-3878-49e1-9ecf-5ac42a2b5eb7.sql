-- Dropar funções existentes para poder recriar com tipos diferentes
DROP FUNCTION IF EXISTS public.get_pending_users_for_clinic(uuid);
DROP FUNCTION IF EXISTS public.get_approved_users_for_clinic(uuid);

-- Recriar get_pending_users_for_clinic com tipos corretos
CREATE OR REPLACE FUNCTION public.get_pending_users_for_clinic(p_cliente_id uuid)
RETURNS TABLE(
  id uuid,
  nome text,
  email text,
  username varchar,
  cargo varchar,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verificar se o usuário é admin ou admin_clinica da clínica especificada
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND (ur.role = 'admin' OR (ur.role = 'admin_clinica' AND EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.cliente_id = p_cliente_id
    )))
  ) THEN
    RAISE EXCEPTION 'Acesso negado: permissão insuficiente';
  END IF;

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
    AND p.cliente_id = p_cliente_id
  ORDER BY p.created_at DESC;
END;
$$;

-- Recriar get_approved_users_for_clinic com tipos corretos
CREATE OR REPLACE FUNCTION public.get_approved_users_for_clinic(p_cliente_id uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  nome text,
  email text,
  username varchar,
  cargo varchar,
  status text,
  role text,
  cliente_nome text,
  data_aprovacao timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verificar se o usuário é admin ou admin_clinica da clínica especificada
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND (ur.role = 'admin' OR (ur.role = 'admin_clinica' AND EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.cliente_id = p_cliente_id
    )))
  ) THEN
    RAISE EXCEPTION 'Acesso negado: permissão insuficiente';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    p.nome,
    p.email,
    p.username,
    p.cargo,
    p.status::text,
    COALESCE(ur.role::text, 'user') as role,
    c.nome as cliente_nome,
    p.data_aprovacao,
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON p.user_id = ur.user_id
  LEFT JOIN public.clientes c ON p.cliente_id = c.id
  WHERE p.status = 'aprovado'
    AND p.cliente_id = p_cliente_id
  ORDER BY p.created_at DESC;
END;
$$;