-- =============================================
-- CORREÇÃO DE 5 POLÍTICAS RLS PERMISSIVAS
-- =============================================

-- =============================================
-- 1. CONFIRMACOES_AUTOMATICAS
-- =============================================
-- Problema: INSERT com WITH CHECK (true)
-- Solução: Restringir INSERT ao cliente_id do usuário

DROP POLICY IF EXISTS "Permitir inserção de confirmações" ON confirmacoes_automaticas;

CREATE POLICY "Permitir inserção de confirmações do próprio cliente"
ON confirmacoes_automaticas FOR INSERT
TO authenticated
WITH CHECK (cliente_id = get_user_cliente_id());

-- =============================================
-- 2. NOTIFICACOES_ENVIADAS
-- =============================================
-- Problema: INSERT com WITH CHECK (true)
-- Solução: Restringir INSERT ao cliente_id do usuário

DROP POLICY IF EXISTS "Sistema pode inserir notificações" ON notificacoes_enviadas;

CREATE POLICY "Usuários podem inserir notificações do próprio cliente"
ON notificacoes_enviadas FOR INSERT
TO authenticated
WITH CHECK (cliente_id IS NULL OR cliente_id = get_user_cliente_id());

-- Adicionar política para UPDATE
CREATE POLICY "Usuários podem atualizar notificações do próprio cliente"
ON notificacoes_enviadas FOR UPDATE
TO authenticated
USING (cliente_id = get_user_cliente_id())
WITH CHECK (cliente_id = get_user_cliente_id());

-- =============================================
-- 3. NOTIFICATION_LOGS
-- =============================================
-- Problema: ALL com auth.uid() IS NOT NULL (muito permissivo)
-- Solução: Restringir via agendamento_id -> agendamentos.cliente_id

DROP POLICY IF EXISTS "Usuarios autenticados podem gerenciar notification_logs" ON notification_logs;

-- SELECT: Usuário pode ver logs de agendamentos do seu cliente
CREATE POLICY "Usuários podem ver logs de notificações do próprio cliente"
ON notification_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM agendamentos a
    WHERE a.id = notification_logs.agendamento_id
    AND a.cliente_id = get_user_cliente_id()
  )
);

-- INSERT: Usuário pode inserir logs para agendamentos do seu cliente
CREATE POLICY "Usuários podem inserir logs do próprio cliente"
ON notification_logs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM agendamentos a
    WHERE a.id = notification_logs.agendamento_id
    AND a.cliente_id = get_user_cliente_id()
  )
);

-- UPDATE: Usuário pode atualizar logs do próprio cliente
CREATE POLICY "Usuários podem atualizar logs do próprio cliente"
ON notification_logs FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM agendamentos a
    WHERE a.id = notification_logs.agendamento_id
    AND a.cliente_id = get_user_cliente_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM agendamentos a
    WHERE a.id = notification_logs.agendamento_id
    AND a.cliente_id = get_user_cliente_id()
  )
);

-- =============================================
-- 4. PREPAROS
-- =============================================
-- Problema: ALL com auth.uid() IS NOT NULL (muito permissivo)
-- Solução: Restringir por cliente_id

DROP POLICY IF EXISTS "Usuarios autenticados podem gerenciar preparos" ON preparos;

-- SELECT: Usuário pode ver preparos do seu cliente OU super admin
CREATE POLICY "Usuários podem ver preparos do próprio cliente"
ON preparos FOR SELECT
TO authenticated
USING (cliente_id = get_user_cliente_id() OR is_super_admin());

-- INSERT: Apenas do próprio cliente
CREATE POLICY "Usuários podem inserir preparos do próprio cliente"
ON preparos FOR INSERT
TO authenticated
WITH CHECK (cliente_id = get_user_cliente_id());

-- UPDATE: Apenas do próprio cliente
CREATE POLICY "Usuários podem atualizar preparos do próprio cliente"
ON preparos FOR UPDATE
TO authenticated
USING (cliente_id = get_user_cliente_id())
WITH CHECK (cliente_id = get_user_cliente_id());

-- DELETE: Apenas do próprio cliente
CREATE POLICY "Usuários podem deletar preparos do próprio cliente"
ON preparos FOR DELETE
TO authenticated
USING (cliente_id = get_user_cliente_id());

-- =============================================
-- 5. SYSTEM_LOGS
-- =============================================
-- Problema: INSERT com WITH CHECK (true)
-- Solução: Usuário só pode inserir logs com seu próprio user_id

DROP POLICY IF EXISTS "Service role pode inserir logs" ON system_logs;

CREATE POLICY "Usuários podem inserir próprios logs"
ON system_logs FOR INSERT
TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Adicionar DELETE restrito a admins
CREATE POLICY "Admins podem deletar logs"
ON system_logs FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin());