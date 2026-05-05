-- [Painel médico - Fase 1.3] RLS policies pra role 'medico' (defesa tripla).
--
-- Estratégia:
--   1. Função helper: user_has_medico_access(medico_id) — encapsula o check
--      contra user_medico_access. Pode ser usada em outras policies futuras.
--   2. Modifica policies existentes (DROP + CREATE) pra adicionar filtro
--      ESPECÍFICO pra role 'medico'. Outros roles (recepcionista, admin_clinica,
--      super_admin) seguem comportamento atual.
--
-- Defesa tripla aplicada em CADA tabela sensível:
--   - Camada 1: cliente_id = get_user_cliente_id() (multi-tenant isolation)
--   - Camada 2: se role=medico, medico_id ∈ assignments ativos do user
--   - Camada 3: profile.status='aprovado' (já no AuthGuard frontend)
--
-- Convenção: policies novas usam sufixo _v2 pra distinguir das antigas durante
-- o rollout, mas aqui aplicamos REPLACE direto (mais limpo). Se precisar reverter,
-- a migration anterior 20260505152925 está intacta.

-- ─── Helper: assignment ativo? ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.user_has_medico_access(_medico_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_medico_access
    WHERE user_id = auth.uid()
      AND medico_id = _medico_id
      AND ativo = true
  );
$$;

COMMENT ON FUNCTION public.user_has_medico_access IS
  'Retorna true se o usuário logado tem assignment ativo pro medico_id. Usada em RLS policies pra role medico.';

GRANT EXECUTE ON FUNCTION public.user_has_medico_access(uuid) TO authenticated, service_role;


-- ─── agendamentos: SELECT ────────────────────────────────────────────────────
-- Comportamento desejado:
--   - super_admin: vê tudo (mantém policy existente agendamentos_select_super_admin)
--   - admin_clinica/recepcionista: vê tudo da clínica (cliente_id = atual)
--   - medico: vê APENAS dos médicos com assignment ativo (E mesmo cliente_id)

DROP POLICY IF EXISTS agendamentos_select ON public.agendamentos;
DROP POLICY IF EXISTS agendamentos_select_clinic ON public.agendamentos;

CREATE POLICY agendamentos_select_clinic ON public.agendamentos
FOR SELECT TO authenticated
USING (
  cliente_id = get_user_cliente_id()
  AND auth.uid() IS NOT NULL
  AND (
    -- Não-médico: vê tudo da clínica (comportamento atual)
    NOT has_role(auth.uid(), 'medico'::app_role)
    -- Médico: só agendamentos dos médicos com assignment ativo
    OR public.user_has_medico_access(medico_id)
  )
);


-- ─── medicos: SELECT ─────────────────────────────────────────────────────────
-- Médico só vê o registro dos médicos a quem tem acesso (titular vê só ele
-- mesmo, secretária vê o médico dela). Outros roles seguem vendo todos da clínica.

DROP POLICY IF EXISTS medicos_select_clinic ON public.medicos;

CREATE POLICY medicos_select_clinic ON public.medicos
FOR SELECT TO authenticated
USING (
  cliente_id = get_user_cliente_id()
  AND (
    NOT has_role(auth.uid(), 'medico'::app_role)
    OR public.user_has_medico_access(id)
  )
);


-- ─── pacientes: SELECT ──────────────────────────────────────────────────────
-- Médico só vê pacientes que TÊM agendamento com algum dos médicos a que ele
-- tem acesso. Recepção/admin continuam vendo todos da clínica.
-- Mantém condição can_access_patient_data() que já existia.

DROP POLICY IF EXISTS pacientes_select_clinic ON public.pacientes;

CREATE POLICY pacientes_select_clinic ON public.pacientes
FOR SELECT TO authenticated
USING (
  cliente_id = get_user_cliente_id()
  AND can_access_patient_data()
  AND (
    NOT has_role(auth.uid(), 'medico'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.agendamentos a
      WHERE a.paciente_id = pacientes.id
        AND a.cliente_id = pacientes.cliente_id
        AND public.user_has_medico_access(a.medico_id)
    )
  )
);


-- ─── bloqueios_agenda: SELECT ───────────────────────────────────────────────
-- Médico vê só bloqueios dos seus médicos.
-- (Útil pra mostrar "férias" na UI sem expor bloqueios de colegas.)

DROP POLICY IF EXISTS bloqueios_select_clinic ON public.bloqueios_agenda;

CREATE POLICY bloqueios_select_clinic ON public.bloqueios_agenda
FOR SELECT TO authenticated
USING (
  cliente_id = get_user_cliente_id()
  AND (
    NOT has_role(auth.uid(), 'medico'::app_role)
    OR (medico_id IS NULL OR public.user_has_medico_access(medico_id))
  )
);


-- ─── INSERT/UPDATE/DELETE: médico continua bloqueado ────────────────────────
-- MVP: médico é apenas leitura. Não criar/editar/cancelar do painel dele.
-- Como as policies de INSERT/UPDATE/DELETE existentes em agendamentos checam
-- apenas cliente_id (sem checar role), e médico tem cliente_id da clínica,
-- ele PODERIA escrever. Vamos restringir explicitamente:

-- Adicionar restrição: médico NÃO escreve em agendamentos
DROP POLICY IF EXISTS agendamentos_insert ON public.agendamentos;
DROP POLICY IF EXISTS agendamentos_insert_clinic ON public.agendamentos;
CREATE POLICY agendamentos_insert_clinic ON public.agendamentos
FOR INSERT TO authenticated
WITH CHECK (
  cliente_id = get_user_cliente_id()
  AND NOT has_role(auth.uid(), 'medico'::app_role)
);

DROP POLICY IF EXISTS agendamentos_update ON public.agendamentos;
DROP POLICY IF EXISTS agendamentos_update_clinic ON public.agendamentos;
CREATE POLICY agendamentos_update_clinic ON public.agendamentos
FOR UPDATE TO authenticated
USING (
  cliente_id = get_user_cliente_id()
  AND auth.uid() IS NOT NULL
  AND NOT has_role(auth.uid(), 'medico'::app_role)
);

DROP POLICY IF EXISTS agendamentos_delete ON public.agendamentos;
DROP POLICY IF EXISTS agendamentos_delete_clinic ON public.agendamentos;
CREATE POLICY agendamentos_delete_clinic ON public.agendamentos
FOR DELETE TO authenticated
USING (
  cliente_id = get_user_cliente_id()
  AND auth.uid() IS NOT NULL
  AND NOT has_role(auth.uid(), 'medico'::app_role)
);

-- Pacientes — médico não cria/edita
DROP POLICY IF EXISTS pacientes_update_clinic ON public.pacientes;
CREATE POLICY pacientes_update_clinic ON public.pacientes
FOR UPDATE TO authenticated
USING (
  cliente_id = get_user_cliente_id()
  AND can_access_patient_data()
  AND NOT has_role(auth.uid(), 'medico'::app_role)
);
