-- Recriar função get_clientes_ativos com SECURITY DEFINER para permitir acesso de admins
CREATE OR REPLACE FUNCTION public.get_clientes_ativos()
RETURNS TABLE (
  id UUID,
  nome TEXT,
  ativo BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se o usuário é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem listar clientes';
  END IF;
  
  RETURN QUERY
  SELECT c.id, c.nome, c.ativo, c.created_at
  FROM public.clientes c
  ORDER BY c.nome;
END;
$$;