-- Corrigir políticas RLS da tabela profiles para resolver erros de permissão
-- Remover políticas problemáticas existentes
DROP POLICY IF EXISTS "authenticated_users_can_read_all_profiles" ON profiles;
DROP POLICY IF EXISTS "authenticated_users_can_insert_profiles" ON profiles;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_can_delete_own_profile" ON profiles;

-- Criar função SECURITY DEFINER para buscar perfil do usuário atual
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  nome text,
  email text,
  role text,
  ativo boolean,
  username text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT p.id, p.user_id, p.nome, p.email, p.role, p.ativo, p.username, p.created_at, p.updated_at
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
$$;

-- Políticas RLS mais permissivas para corrigir os erros
CREATE POLICY "profiles_select_all" ON profiles
FOR SELECT 
USING (true);

CREATE POLICY "profiles_insert_authenticated" ON profiles
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "profiles_update_own" ON profiles
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_delete_own" ON profiles
FOR DELETE 
USING (auth.uid() = user_id);

-- Garantir que o trigger de criação de perfil está funcionando
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email, role, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'recepcionista'),
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Recriar o trigger caso não exista
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();