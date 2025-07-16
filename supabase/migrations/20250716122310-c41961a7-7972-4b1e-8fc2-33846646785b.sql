-- Corrigir problema de recursão infinita nas políticas RLS da tabela profiles
-- 1. Remover políticas problemáticas
DROP POLICY IF EXISTS "admins_can_see_all_profiles" ON profiles;

-- 2. Criar função SECURITY DEFINER para verificar se usuário é admin (evita recursão)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND status = 'aprovado'
  );
$$;

-- 3. Recriar política para admins usando a função
CREATE POLICY "admins_can_see_all_profiles" ON profiles
FOR SELECT 
USING (public.is_admin_user());

-- 4. Garantir que a função get_current_user_profile funciona corretamente
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  nome text,
  email text,
  role text,
  ativo boolean,
  username text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT p.id, p.user_id, p.nome, p.email, p.role, p.ativo, p.username, p.status, p.created_at, p.updated_at
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
$$;