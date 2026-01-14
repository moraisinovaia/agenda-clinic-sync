
-- =====================================================
-- CORREÇÕES DE SEGURANÇA CRÍTICAS - RLS POLICIES
-- Corrigido: usar 'admin' em vez de 'super_admin' (não existe no enum)
-- =====================================================

-- =====================================================
-- 1. TABELA audit_logs - Proteger Logs de Auditoria
-- =====================================================

-- Remover políticas existentes de audit_logs
DROP POLICY IF EXISTS "Admins podem ver audit logs da sua clinica" ON public.audit_logs;
DROP POLICY IF EXISTS "Super admin pode ver todos os audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Usuarios podem ver logs do proprio cliente" ON public.audit_logs;

-- Criar/atualizar função is_super_admin para usar a função existente ou verificar admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
$$;

-- Política: Apenas admins podem LER logs de auditoria
CREATE POLICY "Admins can read audit logs"
ON public.audit_logs
FOR SELECT
USING (
  public.is_super_admin() OR 
  (cliente_id = get_user_cliente_id() AND has_role(auth.uid(), 'admin'::app_role))
);

-- Política: Sistema pode inserir logs (via triggers e edge functions)
CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- NENHUMA política de UPDATE ou DELETE - logs são imutáveis

-- =====================================================
-- 2. TABELA profiles - Restringir Criação de Perfis
-- =====================================================

-- Remover políticas problemáticas que permitem criação sem restrição
DROP POLICY IF EXISTS "Allow profile creation via trigger" ON public.profiles;
DROP POLICY IF EXISTS "Profile creation" ON public.profiles;

-- Política: Usuários podem criar APENAS seu próprio perfil com status pendente
CREATE POLICY "Users can create only their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (user_id = auth.uid() AND status = 'pendente');

-- =====================================================
-- 3. TABELA system_logs - Proteger Logs do Sistema
-- =====================================================

-- Remover políticas existentes (verificar nomes)
DROP POLICY IF EXISTS "Admins can view all logs" ON public.system_logs;

-- Apenas admins podem ler logs do sistema
CREATE POLICY "Admins can view system logs"
ON public.system_logs
FOR SELECT
USING (
  public.is_super_admin() OR has_role(auth.uid(), 'admin'::app_role)
);

-- Qualquer operação pode inserir logs (para triggers e edge functions)
CREATE POLICY "System can insert system logs"
ON public.system_logs
FOR INSERT
WITH CHECK (true);

-- =====================================================
-- 4. TABELA notificacoes_enviadas - Restringir Acesso
-- =====================================================

-- Remover política de visualização geral se existir
DROP POLICY IF EXISTS "Usuários podem ver notificações de seus clientes" ON public.notificacoes_enviadas;

-- Apenas admins e usuários da clínica podem ver notificações
CREATE POLICY "Users can view clinic notifications"
ON public.notificacoes_enviadas
FOR SELECT
USING (
  cliente_id = get_user_cliente_id() AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'admin_clinica'::app_role) OR has_role(auth.uid(), 'recepcionista'::app_role))
);

-- =====================================================
-- COMENTÁRIOS SOBRE FALSOS POSITIVOS
-- =====================================================
-- As seguintes tabelas têm acesso "amplo" por DESIGN:
-- - pacientes: Recepcionistas DEVEM ver todos os pacientes da clínica
-- - agendamentos: Recepcionistas DEVEM ver todos os agendamentos da clínica
-- - medicos: Todos os usuários aprovados DEVEM ver médicos disponíveis
-- O isolamento multi-tenant por cliente_id está funcionando corretamente
