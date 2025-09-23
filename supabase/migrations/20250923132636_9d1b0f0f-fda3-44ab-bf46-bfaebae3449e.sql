-- Remover função problemática e criar uma nova simples e funcional
DROP FUNCTION IF EXISTS public.get_clientes_simple();

CREATE OR REPLACE FUNCTION public.get_clientes_admin()
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
  -- Verificação direta de admin sem usar função ambígua
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND status = 'aprovado'
  ) THEN
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