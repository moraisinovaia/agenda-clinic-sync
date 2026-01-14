-- =============================================
-- CORREÇÃO DE ISOLAMENTO MULTI-TENANT
-- Profiles e Audit Logs - Restringir por cliente_id
-- =============================================

-- 1. PROFILES: Remover política que permite admin ver tudo
DROP POLICY IF EXISTS "Admins globais podem ver todos os profiles" ON public.profiles;

-- 2. PROFILES: Criar política com filtro de cliente_id para admins
CREATE POLICY "Admins podem ver profiles da sua clinica"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND cliente_id = get_user_cliente_id()
);

-- 3. AUDIT_LOGS: Remover política aberta para admins
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;

-- 4. AUDIT_LOGS: Criar política com filtro de cliente_id para admins
CREATE POLICY "Admins podem ver audit logs da sua clinica"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND cliente_id = get_user_cliente_id()
);

-- 5. AUDIT_LOGS: Remover política antiga de usuários
DROP POLICY IF EXISTS "Usuários podem ver logs da sua clínica" ON public.audit_logs;

-- 6. AUDIT_LOGS: Criar política unificada para usuários por cliente_id
CREATE POLICY "Usuarios podem ver logs do proprio cliente"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  cliente_id = get_user_cliente_id()
);