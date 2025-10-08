-- ============================================================================
-- CORREÇÃO DAS POLICIES RLS DA TABELA horarios_vazios
-- Problema: policies antigas tentam acessar auth.users diretamente causando erro 403
-- Solução: usar função helper get_user_cliente_id() que já existe
-- ============================================================================

-- 1. DROP das policies antigas
DROP POLICY IF EXISTS "horarios_vazios_select_policy" ON public.horarios_vazios;
DROP POLICY IF EXISTS "horarios_vazios_insert_policy" ON public.horarios_vazios;
DROP POLICY IF EXISTS "horarios_vazios_update_policy" ON public.horarios_vazios;
DROP POLICY IF EXISTS "horarios_vazios_delete_policy" ON public.horarios_vazios;
DROP POLICY IF EXISTS "horarios_vazios_select_super_admin" ON public.horarios_vazios;
DROP POLICY IF EXISTS "horarios_vazios_insert_super_admin" ON public.horarios_vazios;
DROP POLICY IF EXISTS "horarios_vazios_update_super_admin" ON public.horarios_vazios;
DROP POLICY IF EXISTS "horarios_vazios_delete_super_admin" ON public.horarios_vazios;

-- 2. CRIAR POLICIES CORRIGIDAS usando get_user_cliente_id()

-- Policy de SELECT: usuários autenticados da mesma clínica
CREATE POLICY "horarios_vazios_select_by_clinic"
ON public.horarios_vazios
FOR SELECT
TO authenticated
USING (
  cliente_id = public.get_user_cliente_id()
);

-- Policy de INSERT: usuários autenticados da mesma clínica
CREATE POLICY "horarios_vazios_insert_by_clinic"
ON public.horarios_vazios
FOR INSERT
TO authenticated
WITH CHECK (
  cliente_id = public.get_user_cliente_id()
);

-- Policy de UPDATE: usuários autenticados da mesma clínica
CREATE POLICY "horarios_vazios_update_by_clinic"
ON public.horarios_vazios
FOR UPDATE
TO authenticated
USING (
  cliente_id = public.get_user_cliente_id()
)
WITH CHECK (
  cliente_id = public.get_user_cliente_id()
);

-- Policy de DELETE: usuários autenticados da mesma clínica
CREATE POLICY "horarios_vazios_delete_by_clinic"
ON public.horarios_vazios
FOR DELETE
TO authenticated
USING (
  cliente_id = public.get_user_cliente_id()
);

-- 3. Policy especial para super admin (acesso total)
CREATE POLICY "horarios_vazios_super_admin_all"
ON public.horarios_vazios
FOR ALL
TO authenticated
USING (
  public.is_super_admin()
)
WITH CHECK (
  public.is_super_admin()
);

-- 4. Garantir que RLS está ativo
ALTER TABLE public.horarios_vazios ENABLE ROW LEVEL SECURITY;

-- Log da correção
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info',
  '[FIX] Policies RLS da tabela horarios_vazios corrigidas',
  'HORARIOS_VAZIOS_RLS_FIX',
  jsonb_build_object(
    'problema', 'permission denied for table users',
    'solucao', 'usar get_user_cliente_id() ao invés de subquery com profiles',
    'policies_criadas', 5
  )
);