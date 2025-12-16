-- =====================================================
-- CORREÇÃO DE ISOLAMENTO MULTI-TENANT
-- bloqueios_agenda e fila_espera
-- =====================================================

-- 1. BLOQUEIOS_AGENDA: Remover política aberta
DROP POLICY IF EXISTS "Usuarios autenticados podem gerenciar bloqueios" ON public.bloqueios_agenda;

-- Criar políticas corretas por cliente
CREATE POLICY "Bloqueios - visualizar da clínica" ON public.bloqueios_agenda
  FOR SELECT USING (cliente_id = get_user_cliente_id());

CREATE POLICY "Bloqueios - criar na clínica" ON public.bloqueios_agenda
  FOR INSERT WITH CHECK (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Bloqueios - atualizar da clínica" ON public.bloqueios_agenda
  FOR UPDATE USING (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Bloqueios - deletar da clínica" ON public.bloqueios_agenda
  FOR DELETE USING (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- 2. FILA_ESPERA: Remover política aberta
DROP POLICY IF EXISTS "Usuarios autenticados podem gerenciar fila_espera" ON public.fila_espera;

-- Criar políticas corretas por cliente
CREATE POLICY "Fila espera - visualizar da clínica" ON public.fila_espera
  FOR SELECT USING (cliente_id = get_user_cliente_id());

CREATE POLICY "Fila espera - criar na clínica" ON public.fila_espera
  FOR INSERT WITH CHECK (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Fila espera - atualizar da clínica" ON public.fila_espera
  FOR UPDATE USING (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Fila espera - deletar da clínica" ON public.fila_espera
  FOR DELETE USING (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);