-- 🔒 SUBSTITUIR POLICIES INSEGURAS POR POLICIES MULTI-TENANT

-- =========================================================
-- PACIENTES
-- =========================================================

DROP POLICY IF EXISTS "Allow all operations on pacientes" ON public.pacientes;

CREATE POLICY "tenant_select_pacientes"
ON public.pacientes
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND cliente_id = get_user_cliente_id()
);

CREATE POLICY "tenant_insert_pacientes"
ON public.pacientes
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND cliente_id = get_user_cliente_id()
);

CREATE POLICY "tenant_update_pacientes"
ON public.pacientes
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND cliente_id = get_user_cliente_id()
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND cliente_id = get_user_cliente_id()
);

CREATE POLICY "tenant_delete_pacientes"
ON public.pacientes
FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND cliente_id = get_user_cliente_id()
);

-- =========================================================
-- AGENDAMENTOS
-- =========================================================

DROP POLICY IF EXISTS "Allow all operations on agendamentos" ON public.agendamentos;

CREATE POLICY "tenant_select_agendamentos"
ON public.agendamentos
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND cliente_id = get_user_cliente_id()
);

CREATE POLICY "tenant_insert_agendamentos"
ON public.agendamentos
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND cliente_id = get_user_cliente_id()
);

CREATE POLICY "tenant_update_agendamentos"
ON public.agendamentos
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND cliente_id = get_user_cliente_id()
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND cliente_id = get_user_cliente_id()
);

CREATE POLICY "tenant_delete_agendamentos"
ON public.agendamentos
FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND cliente_id = get_user_cliente_id()
);

-- =========================================================
-- FILA_ESPERA
-- =========================================================

DROP POLICY IF EXISTS "Public access to fila_espera" ON public.fila_espera;

CREATE POLICY "tenant_select_fila_espera"
ON public.fila_espera
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND cliente_id = get_user_cliente_id()
);

CREATE POLICY "tenant_insert_fila_espera"
ON public.fila_espera
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND cliente_id = get_user_cliente_id()
);

CREATE POLICY "tenant_update_fila_espera"
ON public.fila_espera
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND cliente_id = get_user_cliente_id()
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND cliente_id = get_user_cliente_id()
);

CREATE POLICY "tenant_delete_fila_espera"
ON public.fila_espera
FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND cliente_id = get_user_cliente_id()
);

-- =========================================================
-- FILA_NOTIFICACOES
-- =========================================================

DROP POLICY IF EXISTS "Public access to fila_notificacoes" ON public.fila_notificacoes;

CREATE POLICY "tenant_select_fila_notificacoes"
ON public.fila_notificacoes
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND cliente_id = get_user_cliente_id()
);

CREATE POLICY "tenant_insert_fila_notificacoes"
ON public.fila_notificacoes
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND cliente_id = get_user_cliente_id()
);

CREATE POLICY "tenant_update_fila_notificacoes"
ON public.fila_notificacoes
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND cliente_id = get_user_cliente_id()
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND cliente_id = get_user_cliente_id()
);

CREATE POLICY "tenant_delete_fila_notificacoes"
ON public.fila_notificacoes
FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND cliente_id = get_user_cliente_id()
);