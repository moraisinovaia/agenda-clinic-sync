-- Criar função RPC para obter usuários aprovados (contorna RLS)
CREATE OR REPLACE FUNCTION public.get_approved_users_for_email_fix()
RETURNS TABLE(user_id UUID, nome TEXT, email TEXT, status TEXT, data_aprovacao TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.user_id, p.nome, p.email, p.status, p.data_aprovacao
  FROM public.profiles p
  WHERE p.status = 'aprovado';
END;
$$;

-- Garantir acesso para service_role
GRANT EXECUTE ON FUNCTION public.get_approved_users_for_email_fix() TO service_role;