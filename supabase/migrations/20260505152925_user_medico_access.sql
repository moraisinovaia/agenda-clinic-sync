-- [Painel médico - Fase 1.1] Tabela de assignments user ↔ medico (M:N).
--
-- Controla quem (auth.users) tem permissão pra ver agenda de qual médico.
-- Padrão profissional usado em Doctolib/Tasy/sistemas hospitalares:
--   - 1 médico pode ter 1+ assignments (titular, secretária, substituto)
--   - Auditoria: granted_by + granted_at + revoked_at preserva histórico
--   - Revogação não-destrutiva via ativo=false (mantém trilha LGPD)
--   - cliente_id redundante intencional → defesa em profundidade nas RLS
--
-- Relacionamento: 1 user pode ter acesso a N médicos; 1 médico pode ter N users.
-- UNIQUE (user_id, medico_id) impede assignment duplicado.

CREATE TABLE IF NOT EXISTS public.user_medico_access (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medico_id   uuid NOT NULL REFERENCES public.medicos(id) ON DELETE CASCADE,
  cliente_id  uuid NOT NULL REFERENCES public.clientes(id),
  ativo       boolean NOT NULL DEFAULT true,
  granted_by  uuid REFERENCES auth.users(id),
  granted_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,
  motivo      text,
  UNIQUE (user_id, medico_id)
);

-- Índices pra performance das policies RLS (consultas via user_id são as mais frequentes)
CREATE INDEX IF NOT EXISTS idx_uma_user_ativo
  ON public.user_medico_access (user_id) WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_uma_medico_ativo
  ON public.user_medico_access (medico_id) WHERE ativo = true;

-- GRANTs (segue padrão Supabase + coreapi_user que já existe no projeto)
GRANT SELECT, INSERT, UPDATE ON public.user_medico_access TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_medico_access TO authenticated;

-- RLS — só super_admin e admin_clinica do mesmo cliente_id manipulam
ALTER TABLE public.user_medico_access ENABLE ROW LEVEL SECURITY;

-- SELECT: super_admin vê tudo; admin_clinica vê do seu cliente_id; medico vê os SEUS
CREATE POLICY uma_select ON public.user_medico_access
FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR (cliente_id = get_user_cliente_id() AND has_role(auth.uid(), 'admin_clinica'::app_role))
  OR (user_id = auth.uid())  -- médico vê os próprios assignments
);

-- INSERT: super_admin ou admin_clinica do mesmo cliente_id
CREATE POLICY uma_insert ON public.user_medico_access
FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin()
  OR (cliente_id = get_user_cliente_id() AND has_role(auth.uid(), 'admin_clinica'::app_role))
);

-- UPDATE: idem (revogar, alterar motivo)
CREATE POLICY uma_update ON public.user_medico_access
FOR UPDATE TO authenticated
USING (
  is_super_admin()
  OR (cliente_id = get_user_cliente_id() AND has_role(auth.uid(), 'admin_clinica'::app_role))
);

-- DELETE: deliberadamente NÃO há policy de DELETE — preferimos revogação via ativo=false
-- pra preservar histórico (compliance LGPD). Quem precisar deletar usa service_role.

COMMENT ON TABLE public.user_medico_access IS
  'Assignments M:N user ↔ medico. Quem pode ver a agenda de quem. Revogação via ativo=false preserva histórico (LGPD).';
COMMENT ON COLUMN public.user_medico_access.ativo IS
  'false = revogado. Não deletar a linha — manter pra trilha de auditoria.';
COMMENT ON COLUMN public.user_medico_access.cliente_id IS
  'Redundante com medicos.cliente_id intencionalmente. Defesa em profundidade nas RLS.';
