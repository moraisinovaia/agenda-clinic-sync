-- Corrigir políticas RLS da tabela profiles
-- Remover políticas duplicadas e criar políticas mais simples

-- Primeiro, vamos remover as políticas existentes
DROP POLICY IF EXISTS "Permitir leitura de perfis autenticados" ON profiles;
DROP POLICY IF EXISTS "Permitir inserção de perfis" ON profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Permitir inserção por trigger de usuário" ON profiles;

-- Criar políticas RLS mais simples e funcionais
-- Permitir leitura para usuários autenticados
CREATE POLICY "profiles_select" ON profiles
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Permitir inserção para usuários autenticados (necessário para o trigger)
CREATE POLICY "profiles_insert" ON profiles
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Permitir que usuários atualizem seu próprio perfil
CREATE POLICY "profiles_update" ON profiles
FOR UPDATE USING (auth.uid() = user_id);

-- Permitir que usuários deletem seu próprio perfil
CREATE POLICY "profiles_delete" ON profiles
FOR DELETE USING (auth.uid() = user_id);