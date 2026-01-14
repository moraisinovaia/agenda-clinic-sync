-- =====================================================
-- CORREÇÃO CRÍTICA DE SEGURANÇA: RLS fila_notificacoes e backup_migracao_endogastro
-- =====================================================

-- 1. CORRIGIR RLS da tabela fila_notificacoes (remover políticas permissivas)
-- Drop políticas existentes permissivas
DROP POLICY IF EXISTS "Allow all access to fila_notificacoes" ON public.fila_notificacoes;
DROP POLICY IF EXISTS "Allow authenticated users to access fila_notificacoes" ON public.fila_notificacoes;
DROP POLICY IF EXISTS "Users can view notifications for their clinic" ON public.fila_notificacoes;
DROP POLICY IF EXISTS "Users can insert notifications for their clinic" ON public.fila_notificacoes;
DROP POLICY IF EXISTS "Users can update notifications for their clinic" ON public.fila_notificacoes;
DROP POLICY IF EXISTS "Service role full access" ON public.fila_notificacoes;

-- Garantir que RLS está ativado
ALTER TABLE public.fila_notificacoes ENABLE ROW LEVEL SECURITY;

-- Criar políticas corretas com filtro por cliente_id
CREATE POLICY "fila_notificacoes_select_by_cliente"
ON public.fila_notificacoes
FOR SELECT
TO authenticated
USING (cliente_id = get_user_cliente_id());

CREATE POLICY "fila_notificacoes_insert_by_cliente"
ON public.fila_notificacoes
FOR INSERT
TO authenticated
WITH CHECK (cliente_id = get_user_cliente_id());

CREATE POLICY "fila_notificacoes_update_by_cliente"
ON public.fila_notificacoes
FOR UPDATE
TO authenticated
USING (cliente_id = get_user_cliente_id());

CREATE POLICY "fila_notificacoes_delete_by_admin"
ON public.fila_notificacoes
FOR DELETE
TO authenticated
USING (
  cliente_id = get_user_cliente_id() 
  AND public.has_role(auth.uid(), 'admin')
);

-- 2. ATIVAR RLS na tabela backup_migracao_endogastro
ALTER TABLE public.backup_migracao_endogastro ENABLE ROW LEVEL SECURITY;

-- Apenas super admins podem acessar backups
CREATE POLICY "backup_migracao_select_superadmin"
ON public.backup_migracao_endogastro
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "backup_migracao_insert_superadmin"
ON public.backup_migracao_endogastro
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "backup_migracao_delete_superadmin"
ON public.backup_migracao_endogastro
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));