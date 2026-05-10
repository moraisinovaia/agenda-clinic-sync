-- [Override profissional - Fase 1.3] Wrapper criar_agendamento_com_override.
--
-- Delega pra criar_agendamento_atomico (função existente) e depois popula
-- as colunas force_* no agendamento criado. Validações de motivo
-- centralizadas aqui (DRY).
--
-- LLM/scheduling-api NÃO chama essa função — usa criar_agendamento_atomico
-- direto (sem override).

CREATE OR REPLACE FUNCTION public.criar_agendamento_com_override(
  p_nome_completo text,
  p_data_nascimento text DEFAULT NULL,
  p_convenio text DEFAULT 'Particular',
  p_telefone text DEFAULT NULL,
  p_celular text DEFAULT NULL,
  p_medico_id uuid DEFAULT NULL,
  p_atendimento_id uuid DEFAULT NULL,
  p_data_agendamento text DEFAULT NULL,
  p_hora_agendamento text DEFAULT NULL,
  p_observacoes text DEFAULT NULL,
  p_criado_por text DEFAULT 'Sistema',
  p_criado_por_user_id uuid DEFAULT NULL,
  p_agendamento_id_edicao uuid DEFAULT NULL,
  p_force_conflict boolean DEFAULT false,
  p_force_motivo_categoria text DEFAULT NULL,
  p_force_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_result json;
  v_agendamento_id uuid;
  v_caller_id uuid := COALESCE(auth.uid(), p_criado_por_user_id);
BEGIN
  IF p_force_motivo_categoria IS NULL THEN
    RAISE EXCEPTION 'Motivo da categoria é obrigatório quando forçando agendamento' USING ERRCODE = '22023';
  END IF;
  IF p_force_motivo_categoria NOT IN ('encaixe','emergencia','paciente_vip','outro') THEN
    RAISE EXCEPTION 'Categoria inválida: %. Valores aceitos: encaixe, emergencia, paciente_vip, outro', p_force_motivo_categoria USING ERRCODE = '22023';
  END IF;
  IF p_force_motivo_categoria = 'outro' AND (p_force_reason IS NULL OR length(btrim(p_force_reason)) < 5) THEN
    RAISE EXCEPTION 'Justificativa obrigatória quando categoria=outro (mínimo 5 caracteres)' USING ERRCODE = '22023';
  END IF;

  v_result := public.criar_agendamento_atomico(
    p_nome_completo, p_data_nascimento, p_convenio, p_telefone, p_celular,
    p_medico_id, p_atendimento_id, p_data_agendamento, p_hora_agendamento,
    p_observacoes, p_criado_por, p_criado_por_user_id,
    p_agendamento_id_edicao, p_force_conflict
  );

  IF (v_result->>'success')::boolean = true AND v_result->>'agendamento_id' IS NOT NULL THEN
    v_agendamento_id := (v_result->>'agendamento_id')::uuid;

    UPDATE public.agendamentos
    SET force_motivo_categoria = p_force_motivo_categoria,
        force_reason = NULLIF(btrim(p_force_reason), ''),
        forced_at = now(),
        forced_by_user_id = v_caller_id
    WHERE id = v_agendamento_id;

    v_result := v_result || jsonb_build_object(
      'forced', true,
      'force_motivo_categoria', p_force_motivo_categoria,
      'force_reason', NULLIF(btrim(p_force_reason), '')
    )::json;
  END IF;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.criar_agendamento_com_override TO authenticated;
