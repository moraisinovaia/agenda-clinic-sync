-- 1. Recreate get_clinicas_para_signup with optional partner filter
DROP FUNCTION IF EXISTS public.get_clinicas_para_signup();

CREATE OR REPLACE FUNCTION public.get_clinicas_para_signup(p_parceiro TEXT DEFAULT NULL)
RETURNS TABLE(id uuid, nome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.nome
  FROM public.clientes c
  WHERE c.ativo = true
    AND (p_parceiro IS NULL OR c.parceiro = p_parceiro)
  ORDER BY c.nome;
END;
$$;

-- 2. Ensure GRANTs for anon (signup is done as anon user)
GRANT EXECUTE ON FUNCTION public.get_clinicas_para_signup(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_clinicas_para_signup(TEXT) TO authenticated;

-- 3. Ensure check_username_available is also accessible by anon
GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT) TO authenticated;