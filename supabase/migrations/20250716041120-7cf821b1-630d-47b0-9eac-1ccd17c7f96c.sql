-- Desabilitar RLS na tabela de auditoria para permitir acesso total
ALTER TABLE public.agendamentos_audit DISABLE ROW LEVEL SECURITY;

-- Remover todas as políticas existentes já que não precisamos mais delas
DROP POLICY IF EXISTS "audit_select_authenticated" ON public.agendamentos_audit;
DROP POLICY IF EXISTS "audit_insert_all" ON public.agendamentos_audit;
DROP POLICY IF EXISTS "audit_update_all" ON public.agendamentos_audit;