-- [F4.2] RPC atômica de remarcação. Antes, o handler reschedule.ts fazia
-- SELECT conflitos → UPDATE em duas chamadas, abrindo race window.
CREATE OR REPLACE FUNCTION public.remarcar_agendamento_atomico_externo(
  p_cliente_id uuid,
  p_agendamento_id uuid,
  p_nova_data date,
  p_nova_hora time without time zone,
  p_observacoes text DEFAULT NULL,
  p_remarcado_por text DEFAULT 'llm-agent'
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_agendamento RECORD;
  v_rows_updated INTEGER;
BEGIN
  IF p_cliente_id IS NULL THEN RAISE EXCEPTION 'cliente_id é obrigatório'; END IF;
  IF p_agendamento_id IS NULL THEN RAISE EXCEPTION 'agendamento_id é obrigatório'; END IF;
  IF p_nova_data IS NULL OR p_nova_hora IS NULL THEN
    RAISE EXCEPTION 'Nova data e hora são obrigatórias';
  END IF;

  SELECT id, cliente_id, medico_id, data_agendamento, hora_agendamento, status,
         excluido_em, cancelado_em, observacoes
  INTO v_agendamento
  FROM public.agendamentos
  WHERE id = p_agendamento_id AND cliente_id = p_cliente_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'NOT_FOUND',
      'message', 'Agendamento não encontrado para este cliente');
  END IF;

  IF v_agendamento.excluido_em IS NOT NULL OR v_agendamento.cancelado_em IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_STATUS',
      'message', 'Agendamento já cancelado/excluído não pode ser remarcado');
  END IF;

  IF v_agendamento.status NOT IN ('agendado', 'confirmado') THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_STATUS',
      'message', format('Status atual "%s" não permite remarcação', v_agendamento.status));
  END IF;

  IF (p_nova_data::timestamp + p_nova_hora) < (now() - interval '1 hour') THEN
    RAISE EXCEPTION 'Não é possível remarcar para uma data/hora que já passou';
  END IF;

  UPDATE public.agendamentos
  SET data_agendamento = p_nova_data,
      hora_agendamento = p_nova_hora,
      observacoes      = COALESCE(NULLIF(TRIM(p_observacoes), ''), observacoes),
      updated_at       = now()
  WHERE id = p_agendamento_id
    AND cliente_id = p_cliente_id
    AND status IN ('agendado', 'confirmado')
    AND excluido_em IS NULL
    AND cancelado_em IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.agendamentos a2
      WHERE a2.medico_id = v_agendamento.medico_id
        AND a2.cliente_id = p_cliente_id
        AND a2.data_agendamento = p_nova_data
        AND a2.hora_agendamento = p_nova_hora
        AND a2.status IN ('agendado', 'confirmado')
        AND a2.excluido_em IS NULL
        AND a2.cancelado_em IS NULL
        AND a2.id <> p_agendamento_id
    );

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    SELECT status, excluido_em, cancelado_em INTO v_agendamento
    FROM public.agendamentos
    WHERE id = p_agendamento_id AND cliente_id = p_cliente_id;

    IF NOT FOUND OR v_agendamento.excluido_em IS NOT NULL OR v_agendamento.cancelado_em IS NOT NULL THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_STATUS',
        'message', 'Agendamento foi cancelado/excluído durante a remarcação');
    END IF;

    RETURN json_build_object('success', false, 'error', 'CONFLICT',
      'message', 'Horário já está ocupado por outro paciente',
      'data_agendamento', p_nova_data, 'hora_agendamento', p_nova_hora);
  END IF;

  RETURN json_build_object('success', true,
    'agendamento_id', p_agendamento_id,
    'data_agendamento', p_nova_data, 'hora_agendamento', p_nova_hora,
    'message', 'Agendamento remarcado com sucesso');

EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'CONFLICT',
      'message', 'Horário já está ocupado por outro paciente',
      'data_agendamento', p_nova_data, 'hora_agendamento', p_nova_hora);
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM,
      'message', 'Erro ao remarcar: ' || SQLERRM);
END;
$function$;
