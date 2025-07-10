-- Limpar todas as políticas RLS conflitantes da tabela profiles
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;
DROP POLICY IF EXISTS "profiles_service_role" ON profiles;

-- Criar políticas RLS simples e funcionais
-- Permitir leitura para usuários autenticados
CREATE POLICY "authenticated_users_can_read_profiles" 
ON profiles FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Permitir inserção para usuários autenticados (necessário para trigger de signup)
CREATE POLICY "authenticated_users_can_insert_profiles" 
ON profiles FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Permitir que usuários atualizem apenas seu próprio perfil
CREATE POLICY "users_can_update_own_profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Permitir que usuários deletem apenas seu próprio perfil
CREATE POLICY "users_can_delete_own_profile" 
ON profiles FOR DELETE 
USING (auth.uid() = user_id);