-- [Inline edit observação] CHECK constraint + RPC dedicada com optimistic lock + audit.
--
-- Substitui PATCH direto via supabase-js por RPC SECURITY DEFINER que:
--   - Valida cliente_id do caller (defesa em profundidade vs RLS)
--   - Valida cargo (apenas recepcionista/administrador editam; Médico bloqueado)
--   - Optimistic lock: rejeita se updated_at no DB ≠ p_expected_updated_at
--   - Bloqueia status terminal (cancelado/cancelado_bloqueio/excluido)
--   - Log explícito em audit_logs com action='observacao_editada' + old/new
--
-- O trigger genérico de UPDATE em agendamentos continua existindo; este
-- log adicional permite filtro rápido por action='observacao_editada'.

-- 1) CHECK constraint pra tamanho máximo (1000 chars — atual max é 301)
ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_observacoes_length_chk;
ALTER TABLE public.agendamentos
  ADD CONSTRAINT agendamentos_observacoes_length_chk
  CHECK (observacoes IS NULL OR length(observacoes) <= 1000);

-- 2) RPC dedicada
CREATE OR REPLACE FUNCTION public.atualizar_observacao_agendamento(
  p_agendamento_id uuid,
  p_observacao text,
  p_expected_updated_at timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_caller_user_id uuid := auth.uid();
  v_caller_cliente_id uuid;
  v_caller_cargo text;
  v_caller_profile_id uuid;
  v_agendamento RECORD;
  v_observacao_normalizada text;
BEGIN
  IF v_caller_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT id, cliente_id, cargo INTO v_caller_profile_id, v_caller_cliente_id, v_caller_cargo
  FROM public.profiles
  WHERE user_id = v_caller_user_id
    AND ativo = true
  LIMIT 1;

  IF v_caller_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Profile do usuário não encontrado ou inativo' USING ERRCODE = '28000';
  END IF;

  -- Apenas recepcionista e administrador editam observação.
  -- Médico vê (DoctorSchedule readOnly) mas não edita.
  IF v_caller_cargo NOT IN ('recepcionista', 'administrador') THEN
    RAISE EXCEPTION 'Apenas recepcionista ou administrador podem editar observação (cargo atual: %)', v_caller_cargo
      USING ERRCODE = '42501';
  END IF;

  -- Carrega agendamento + lock pra leitura consistente do updated_at
  SELECT id, cliente_id, status, observacoes, updated_at
    INTO v_agendamento
  FROM public.agendamentos
  WHERE id = p_agendamento_id
  FOR UPDATE;

  IF v_agendamento.id IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- Multi-tenant: agendamento precisa ser do mesmo cliente do caller
  IF v_agendamento.cliente_id <> v_caller_cliente_id THEN
    RAISE EXCEPTION 'Agendamento pertence a outro cliente' USING ERRCODE = '42501';
  END IF;

  -- Status terminal bloqueado
  IF v_agendamento.status IN ('cancelado', 'cancelado_bloqueio', 'excluido') THEN
    RAISE EXCEPTION 'Não é possível editar observação de agendamento com status %', v_agendamento.status
      USING ERRCODE = '22023';
  END IF;

  -- Optimistic lock
  IF v_agendamento.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'Agendamento foi modificado por outro usuário. Recarregue a página.'
      USING ERRCODE = '40001';
  END IF;

  -- Normaliza: trim + transforma string vazia em NULL
  v_observacao_normalizada := NULLIF(btrim(p_observacao), '');

  -- Tamanho (DB CHECK já protege, mas erro amigável aqui)
  IF v_observacao_normalizada IS NOT NULL AND length(v_observacao_normalizada) > 1000 THEN
    RAISE EXCEPTION 'Observação excede 1000 caracteres (atual: %)', length(v_observacao_normalizada)
      USING ERRCODE = '22001';
  END IF;

  -- No-op se valor não mudou (evita audit log desnecessário)
  IF v_agendamento.observacoes IS NOT DISTINCT FROM v_observacao_normalizada THEN
    RETURN json_build_object(
      'success', true,
      'changed', false,
      'observacoes', v_observacao_normalizada,
      'updated_at', v_agendamento.updated_at
    );
  END IF;

  UPDATE public.agendamentos
  SET observacoes = v_observacao_normalizada,
      updated_at = now()
  WHERE id = p_agendamento_id;

  -- Audit explícito (além do trigger genérico)
  INSERT INTO public.audit_logs (
    audit_timestamp, user_id, action, table_name, record_id,
    old_values, new_values, changed_fields, cliente_id
  ) VALUES (
    now(),
    v_caller_user_id,
    'observacao_editada',
    'agendamentos',
    p_agendamento_id,
    jsonb_build_object('observacoes', v_agendamento.observacoes),
    jsonb_build_object('observacoes', v_observacao_normalizada),
    ARRAY['observacoes'],
    v_caller_cliente_id
  );

  RETURN json_build_object(
    'success', true,
    'changed', true,
    'observacoes', v_observacao_normalizada,
    'updated_at', (SELECT updated_at FROM public.agendamentos WHERE id = p_agendamento_id)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.atualizar_observacao_agendamento(uuid, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atualizar_observacao_agendamento(uuid, text, timestamptz) TO authenticated;
