-- Fix RLS: medicos e atendimentos
-- Estado anterior:
--   medicos    → RLS nunca habilitado; policies de 20251212 existem mas são ignoradas
--   atendimentos → RLS nunca habilitado; sem policies ativas (permissivas foram dropadas em 20251212)
-- Padrão: duas policies por operação — clinic user (get_user_cliente_id) + super_admin (is_super_admin)
-- n8n não é afetado: RPCs que ele usa são SECURITY DEFINER e contornam RLS

-- ═══════════════════════════════════════════════════════════════════
-- MEDICOS
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.medicos ENABLE ROW LEVEL SECURITY;

-- Remove policies existentes (criadas em 20251212 sem RLS ativo — nunca tiveram efeito)
DROP POLICY IF EXISTS "Medicos - visualizar da clínica"   ON public.medicos;
DROP POLICY IF EXISTS "Medicos - criar na clínica"        ON public.medicos;
DROP POLICY IF EXISTS "Medicos - atualizar da clínica"    ON public.medicos;
DROP POLICY IF EXISTS "Medicos - deletar da clínica"      ON public.medicos;
-- Remove possíveis variações de nomes anteriores
DROP POLICY IF EXISTS "Public access to medicos"          ON public.medicos;
DROP POLICY IF EXISTS "Allow public read for active medicos" ON public.medicos;
-- Remove caso migration seja re-executada
DROP POLICY IF EXISTS "medicos_select"                    ON public.medicos;
DROP POLICY IF EXISTS "medicos_select_super_admin"        ON public.medicos;
DROP POLICY IF EXISTS "medicos_insert"                    ON public.medicos;
DROP POLICY IF EXISTS "medicos_update"                    ON public.medicos;
DROP POLICY IF EXISTS "medicos_delete"                    ON public.medicos;

-- Leitura: usuários da clínica
CREATE POLICY "medicos_select"
  ON public.medicos FOR SELECT TO authenticated
  USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- Leitura: super_admin vê todos
CREATE POLICY "medicos_select_super_admin"
  ON public.medicos FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- Escrita: apenas usuários da própria clínica
CREATE POLICY "medicos_insert"
  ON public.medicos FOR INSERT TO authenticated
  WITH CHECK (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "medicos_update"
  ON public.medicos FOR UPDATE TO authenticated
  USING  (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL)
  WITH CHECK (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "medicos_delete"
  ON public.medicos FOR DELETE TO authenticated
  USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- ═══════════════════════════════════════════════════════════════════
-- ATENDIMENTOS
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;

-- Remove policies permissivas antigas e possíveis variações
DROP POLICY IF EXISTS "Public access to atendimentos"     ON public.atendimentos;
-- Remove caso migration seja re-executada
DROP POLICY IF EXISTS "atendimentos_select"               ON public.atendimentos;
DROP POLICY IF EXISTS "atendimentos_select_super_admin"   ON public.atendimentos;
DROP POLICY IF EXISTS "atendimentos_insert"               ON public.atendimentos;
DROP POLICY IF EXISTS "atendimentos_update"               ON public.atendimentos;
DROP POLICY IF EXISTS "atendimentos_delete"               ON public.atendimentos;

-- Leitura: usuários da clínica
CREATE POLICY "atendimentos_select"
  ON public.atendimentos FOR SELECT TO authenticated
  USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- Leitura: super_admin vê todos
CREATE POLICY "atendimentos_select_super_admin"
  ON public.atendimentos FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- Escrita: apenas usuários da própria clínica
CREATE POLICY "atendimentos_insert"
  ON public.atendimentos FOR INSERT TO authenticated
  WITH CHECK (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "atendimentos_update"
  ON public.atendimentos FOR UPDATE TO authenticated
  USING  (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL)
  WITH CHECK (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "atendimentos_delete"
  ON public.atendimentos FOR DELETE TO authenticated
  USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);
