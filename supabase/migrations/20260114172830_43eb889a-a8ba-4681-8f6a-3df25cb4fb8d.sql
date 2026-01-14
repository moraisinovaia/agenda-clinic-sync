-- =====================================================
-- CORREÇÕES DE SEGURANÇA: Extensões + RLS Policies
-- =====================================================

-- 1. MOVER EXTENSÃO VECTOR PARA SCHEMA EXTENSIONS
-- =====================================================
-- Criar schema extensions se não existir
CREATE SCHEMA IF NOT EXISTS extensions;

-- Mover extensão vector para o schema extensions
ALTER EXTENSION vector SET SCHEMA extensions;

-- 2. CORRIGIR RLS: audit_logs
-- =====================================================
-- Remover política permissiva que permite INSERT público
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;

-- Nova política: apenas usuários autenticados podem inserir
CREATE POLICY "Authenticated can insert audit logs" ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (cliente_id IS NULL) OR 
    (cliente_id = get_user_cliente_id())
  );

-- 3. CORRIGIR RLS: system_logs
-- =====================================================
-- Remover política permissiva que permite INSERT público
DROP POLICY IF EXISTS "System can insert system logs" ON system_logs;

-- Nova política: usuários autenticados podem inserir seus próprios logs
CREATE POLICY "Authenticated can insert system logs" ON system_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (user_id IS NULL) OR 
    (user_id = auth.uid())
  );

-- 4. CORRIGIR RLS: system_backups
-- =====================================================
-- Remover política service_role muito permissiva (USING true, WITH CHECK true)
DROP POLICY IF EXISTS "Service role full access to backups" ON system_backups;

-- Política "Admins can manage backups" já existe e é adequada

-- 5. CORRIGIR RLS: system_settings
-- =====================================================
-- Remover política service_role muito aberta
DROP POLICY IF EXISTS "Service role can read settings" ON system_settings;

-- Política "Admins can manage settings" já existe e é adequada

-- =====================================================
-- VERIFICAÇÃO: Confirmar alterações
-- =====================================================
-- As políticas restantes são adequadas:
-- - audit_logs: "Admins can view audit logs" (SELECT para admins)
-- - system_logs: "Admins can view system logs" (SELECT para admins)
-- - system_backups: "Admins can manage backups" (ALL para admins)
-- - system_settings: "Admins can manage settings" (ALL para admins)