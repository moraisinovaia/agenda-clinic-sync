-- Corrigir política RLS da tabela profiles para permitir leitura pública
-- Isso é necessário para o SystemMonitor funcionar corretamente

-- Primeiro, vamos criar uma política que permite leitura da tabela profiles para todos os usuários autenticados
-- sem restrições, pois o sistema precisa acessar os nomes dos usuários

-- Remover a política muito restritiva atual
DROP POLICY IF EXISTS "authenticated_users_can_read_profiles" ON profiles;

-- Criar nova política que permite leitura para todos os usuários autenticados
CREATE POLICY "authenticated_users_can_read_all_profiles" 
ON profiles FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Manter as outras políticas como estão para insert, update e delete