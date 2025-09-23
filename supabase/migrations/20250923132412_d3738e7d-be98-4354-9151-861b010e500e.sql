-- Excluir a função problemática atual
DROP FUNCTION IF EXISTS public.get_clientes_for_admin(uuid);

-- Criar nova função simples para buscar clientes
CREATE OR REPLACE FUNCTION public.get_clientes_simple()
RETURNS TABLE (
  id uuid,
  nome text,
  ativo boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se é admin usando a função que já funciona
  IF NOT public.is_admin_safe() THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores podem acessar esta função.';
  END IF;

  -- Retornar clientes ativos ordenados por nome
  RETURN QUERY
  SELECT 
    c.id,
    c.nome::text,
    c.ativo
  FROM public.clientes c
  WHERE c.ativo = true
  ORDER BY c.nome;
END;
$$;