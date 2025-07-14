-- Corrigir políticas RLS da tabela profiles para permitir acesso necessário ao sistema de alertas
-- Isso é necessário para o SystemMonitor e AlertSystem funcionarem corretamente

-- Remover a política muito restritiva atual se existe
DROP POLICY IF EXISTS "authenticated_users_can_read_all_profiles" ON profiles;

-- Criar nova política que permite leitura para todos os usuários autenticados
CREATE POLICY "authenticated_users_can_read_all_profiles" 
ON profiles FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Garantir que as outras políticas funcionem corretamente
-- Política para inserção (já existe)
DROP POLICY IF EXISTS "authenticated_users_can_insert_profiles" ON profiles;
CREATE POLICY "authenticated_users_can_insert_profiles" 
ON profiles FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Política para atualização própria (já existe)
DROP POLICY IF EXISTS "users_can_update_own_profile" ON profiles;
CREATE POLICY "users_can_update_own_profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Política para deletar próprio perfil (já existe)
DROP POLICY IF EXISTS "users_can_delete_own_profile" ON profiles;
CREATE POLICY "users_can_delete_own_profile" 
ON profiles FOR DELETE 
USING (auth.uid() = user_id);