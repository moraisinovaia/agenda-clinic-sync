-- Criar função alternativa que aceita user_id como parâmetro
CREATE OR REPLACE FUNCTION public.is_admin_with_user_id(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE user_id = check_user_id 
    AND role = 'admin' 
    AND status = 'aprovado'
  );
$$;

-- Criar função para buscar clientes como admin (fallback)
CREATE OR REPLACE FUNCTION public.get_clientes_for_admin(requesting_user_id uuid)
RETURNS TABLE(
  id uuid,
  nome text,
  logo_url text,
  ativo boolean,
  configuracoes jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se o usuário é admin
  IF NOT public.is_admin_with_user_id(requesting_user_id) THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores podem acessar esta função.';
  END IF;

  -- Retornar todos os clientes
  RETURN QUERY
  SELECT 
    c.id,
    c.nome,
    c.logo_url,
    c.ativo,
    c.configuracoes,
    c.created_at,
    c.updated_at
  FROM public.clientes c
  ORDER BY c.nome;
END;
$$;