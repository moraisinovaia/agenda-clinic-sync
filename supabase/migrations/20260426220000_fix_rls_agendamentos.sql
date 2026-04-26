-- Fix RLS crítico: isolamento multi-tenant em agendamentos
-- Policies antigas usavam USING (true) — qualquer usuário autenticado via o banco inteiro.
-- Padrão correto: duas policies por operação (clinic user + super_admin), igual a horarios_vazios.

ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

-- Remove policies antigas pelo nome exato que existia antes
DROP POLICY IF EXISTS "Usuários autenticados podem ver agendamentos"      ON public.agendamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem criar agendamentos"    ON public.agendamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar agendamentos"  ON public.agendamentos;

-- Remove caso já existam versões parciais desta migration
DROP POLICY IF EXISTS "agendamentos_select"       ON public.agendamentos;
DROP POLICY IF EXISTS "agendamentos_insert"       ON public.agendamentos;
DROP POLICY IF EXISTS "agendamentos_update"       ON public.agendamentos;
DROP POLICY IF EXISTS "agendamentos_delete"       ON public.agendamentos;
DROP POLICY IF EXISTS "agendamentos_super_admin"        ON public.agendamentos;
DROP POLICY IF EXISTS "agendamentos_select_super_admin" ON public.agendamentos;

-- Usuários de clínica: leitura restrita ao próprio cliente_id
CREATE POLICY "agendamentos_select"
  ON public.agendamentos FOR SELECT TO authenticated
  USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- Super admin: acesso total para leitura (MultiClinicDashboard)
CREATE POLICY "agendamentos_select_super_admin"
  ON public.agendamentos FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- Escrita: apenas usuários da própria clínica (RPCs SECURITY DEFINER contornam RLS — isso protege REST direto)
CREATE POLICY "agendamentos_insert"
  ON public.agendamentos FOR INSERT TO authenticated
  WITH CHECK (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "agendamentos_update"
  ON public.agendamentos FOR UPDATE TO authenticated
  USING  (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL)
  WITH CHECK (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "agendamentos_delete"
  ON public.agendamentos FOR DELETE TO authenticated
  USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);
