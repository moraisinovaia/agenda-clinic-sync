-- Refatoração M:N: serviços centralizados por clínica, médicos vinculados via pivot.
--
-- Problema anterior: atendimentos.medico_id forçava 1 serviço = 1 médico.
-- "Consulta Cardiológica" existia como N registros duplicados, 1 por médico.
--
-- Nova arquitetura:
--   atendimentos  → serviço centralizado por cliente (sem medico_id)
--   medico_atendimento → pivot M:N com valor_override opcional por médico

-- ═══════════════════════════════════════════════════════════════
-- 1. CRIAR TABELA PIVOT
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.medico_atendimento (
  id             UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medico_id      UUID          NOT NULL REFERENCES public.medicos(id)      ON DELETE CASCADE,
  atendimento_id UUID          NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
  cliente_id     UUID          NOT NULL REFERENCES public.clientes(id)     ON DELETE CASCADE,
  valor_override NUMERIC(10,2)          DEFAULT NULL,  -- NULL = usa valor do atendimento
  ativo          BOOLEAN       NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT uq_medico_atendimento UNIQUE (medico_id, atendimento_id)
);

-- Índices para performance nas queries mais comuns
CREATE INDEX idx_medico_atendimento_medico    ON public.medico_atendimento(medico_id);
CREATE INDEX idx_medico_atendimento_atend     ON public.medico_atendimento(atendimento_id);
CREATE INDEX idx_medico_atendimento_cliente   ON public.medico_atendimento(cliente_id);

-- Trigger de updated_at (mesma função usada em atendimentos/medicos)
CREATE TRIGGER update_medico_atendimento_updated_at
  BEFORE UPDATE ON public.medico_atendimento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- 2. RLS — isolamento por clínica (mesmo padrão de atendimentos/medicos)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.medico_atendimento ENABLE ROW LEVEL SECURITY;

-- Super admin vê tudo (mesmo padrão de atendimentos_super_admin)
CREATE POLICY "medico_atendimento_super_admin"
  ON public.medico_atendimento FOR ALL
  USING (is_super_admin());

-- Admin/recepcionista: somente dados da própria clínica
CREATE POLICY "medico_atendimento_select_clinic"
  ON public.medico_atendimento FOR SELECT
  USING (cliente_id = get_user_cliente_id());

CREATE POLICY "medico_atendimento_insert_clinic"
  ON public.medico_atendimento FOR INSERT
  WITH CHECK (cliente_id = get_user_cliente_id());

CREATE POLICY "medico_atendimento_update_clinic"
  ON public.medico_atendimento FOR UPDATE
  USING (cliente_id = get_user_cliente_id())
  WITH CHECK (cliente_id = get_user_cliente_id());

CREATE POLICY "medico_atendimento_delete_clinic"
  ON public.medico_atendimento FOR DELETE
  USING (cliente_id = get_user_cliente_id());

-- ═══════════════════════════════════════════════════════════════
-- 3. GRANTS — espelha o padrão de atendimentos/medicos
-- ═══════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.medico_atendimento
  TO anon, authenticated, service_role, coreapi_user;

-- ═══════════════════════════════════════════════════════════════
-- 4. POPULAR PIVOT a partir do medico_id existente em atendimentos
--    Cada atendimento com medico_id vira uma entrada na pivot.
--    ON CONFLICT DO NOTHING: seguro para re-execução.
-- ═══════════════════════════════════════════════════════════════

INSERT INTO public.medico_atendimento (medico_id, atendimento_id, cliente_id, ativo)
SELECT
  a.medico_id,
  a.id,
  a.cliente_id,
  COALESCE(a.ativo, true)
FROM public.atendimentos a
WHERE a.medico_id IS NOT NULL
ON CONFLICT (medico_id, atendimento_id) DO NOTHING;
