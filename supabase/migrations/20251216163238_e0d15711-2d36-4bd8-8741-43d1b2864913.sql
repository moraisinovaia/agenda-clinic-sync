-- =====================================================
-- CORREÇÃO DEFINITIVA DE SEGURANÇA
-- =====================================================

-- 1. PROFILES: Remover política de acesso público (nome correto)
DROP POLICY IF EXISTS "Allow username lookup for login" ON public.profiles;

-- 2. AUDIT_LOGS: Remover política de INSERT irrestrito (nome correto)
DROP POLICY IF EXISTS "Sistema pode inserir audit logs" ON public.audit_logs;

-- 3. Resolver overloading da função get_email_by_username
-- Remover versão TEXT (manter VARCHAR que foi criada na última migração)
DROP FUNCTION IF EXISTS public.get_email_by_username(TEXT);