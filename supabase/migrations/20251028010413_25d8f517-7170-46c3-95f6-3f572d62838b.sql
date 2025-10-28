-- Criar função SECURITY DEFINER para buscar profiles sem recursão RLS
CREATE OR REPLACE FUNCTION get_user_profiles(user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  nome text,
  email text,
  ativo boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT 
    user_id,
    nome,
    email,
    ativo
  FROM profiles
  WHERE user_id = ANY(user_ids);
$$;

-- Permitir que usuários autenticados chamem esta função
GRANT EXECUTE ON FUNCTION get_user_profiles(uuid[]) TO authenticated;