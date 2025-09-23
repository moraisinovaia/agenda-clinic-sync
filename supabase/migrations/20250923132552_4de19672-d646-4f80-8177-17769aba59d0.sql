-- Recriar a função usando a is_admin_safe sem parâmetros
DROP FUNCTION IF EXISTS public.get_clientes_simple();

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
  -- Verificar se é admin usando a função sem parâmetros que funciona
  IF NOT (SELECT public.is_admin_safe()) THEN
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