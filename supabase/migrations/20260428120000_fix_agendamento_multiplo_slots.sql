-- Reescreve criar_agendamento_multiplo para:
-- 1. Encontrar N slots livres reais a partir do horário inicial (sem assumir incremento fixo)
-- 2. Usar advisory lock para evitar concorrência
-- 3. Garantir all-or-nothing (sem EXCEPTION WHEN OTHERS: rollback automático do PostgreSQL)

CREATE OR REPLACE FUNCTION public.criar_agendamento_multiplo(
  p_nome_completo       text,
  p_data_nascimento     date,
  p_convenio            text,
  p_telefone            text,
  p_celular             text,
  p_medico_id           uuid,
  p_atendimento_ids     uuid[],
  p_data_agendamento    date,
  p_hora_agendamento    time without time zone,
  p_observacoes         text    DEFAULT NULL,
  p_criado_por          text    DEFAULT 'recepcionista',
  p_criado_por_user_id  uuid    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id          uuid;
  v_paciente_id         uuid;
  v_agendamento_ids     uuid[]   := '{}';
  v_doctor_record       RECORD;
  v_patient_age         integer;
  v_blocked_check       integer;
  v_atendimento_id      uuid;
  v_current_agend_id    uuid;
  v_combined_obs        text     := '';
  v_atendimento_name    text;
  v_atendimento_names   text[]   := '{}';
  v_age_note            text     := '';

  -- Busca de slots
  v_n_exames            integer;
  v_occupied_horas      time[]   := '{}';
  v_candidate           time;
  v_free_slots          time[]   := '{}';
  v_iterations          integer  := 0;
  v_max_iterations      integer  := 1440; -- max 24h buscando 1 slot/min
  v_slot_idx            integer  := 1;
BEGIN
  -- ── Advisory lock: serializa inserções para mesmo médico + data ──
  PERFORM pg_advisory_xact_lock(
    hashtext(p_medico_id::text || p_data_agendamento::text)
  );

  -- ── Tenant ──
  v_cliente_id := get_user_cliente_id();
  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem cliente_id — contacte o administrador';
  END IF;

  v_n_exames := array_length(p_atendimento_ids, 1);
  IF v_n_exames IS NULL OR v_n_exames = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos um atendimento';
  END IF;

  -- ── Nomes dos atendimentos ──
  FOR v_atendimento_id IN SELECT unnest(p_atendimento_ids) LOOP
    SELECT nome INTO v_atendimento_name
      FROM public.atendimentos WHERE id = v_atendimento_id;
    IF v_atendimento_name IS NOT NULL THEN
      v_atendimento_names := array_append(v_atendimento_names, v_atendimento_name);
    END IF;
  END LOOP;

  IF array_length(v_atendimento_names, 1) > 1 THEN
    v_combined_obs := 'Agendamento múltiplo: ' || array_to_string(v_atendimento_names, ' + ');
    IF p_observacoes IS NOT NULL AND trim(p_observacoes) <> '' THEN
      v_combined_obs := v_combined_obs || '. ' || p_observacoes;
    END IF;
  ELSE
    v_combined_obs := p_observacoes;
  END IF;

  -- ── Validar médico ──
  SELECT m.* INTO v_doctor_record
    FROM public.medicos m WHERE m.id = p_medico_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Médico não encontrado';
  END IF;
  IF NOT v_doctor_record.ativo THEN
    RAISE EXCEPTION 'Médico não está ativo';
  END IF;

  -- ── Validar bloqueio de agenda ──
  SELECT COUNT(*) INTO v_blocked_check
    FROM public.bloqueios_agenda
   WHERE medico_id = p_medico_id
     AND status = 'ativo'
     AND p_data_agendamento BETWEEN data_inicio AND data_fim;
  IF v_blocked_check > 0 THEN
    RAISE EXCEPTION 'A agenda está bloqueada nesta data';
  END IF;

  -- ── Validar data/hora no passado ──
  IF (p_data_agendamento::timestamp + p_hora_agendamento) < (now() - interval '1 hour') THEN
    RAISE EXCEPTION 'Não é possível agendar para uma data/hora que já passou';
  END IF;

  -- ── Validar idade ──
  IF p_data_nascimento IS NOT NULL THEN
    SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_data_nascimento))::integer
      INTO v_patient_age;
    IF v_doctor_record.idade_minima IS NOT NULL AND v_patient_age < v_doctor_record.idade_minima THEN
      v_age_note := format(' [Idade %s anos - abaixo do padrão %s anos]',
                           v_patient_age, v_doctor_record.idade_minima);
    END IF;
    IF v_doctor_record.idade_maxima IS NOT NULL AND v_patient_age > v_doctor_record.idade_maxima THEN
      v_age_note := v_age_note || format(' [Idade %s anos - acima do padrão %s anos]',
                                          v_patient_age, v_doctor_record.idade_maxima);
    END IF;
  END IF;

  -- ── Validar convênio ──
  IF v_doctor_record.convenios_aceitos IS NOT NULL
     AND array_length(v_doctor_record.convenios_aceitos, 1) > 0
     AND NOT (p_convenio = ANY(v_doctor_record.convenios_aceitos)) THEN
    RAISE EXCEPTION 'Convênio "%" não é aceito por este médico', p_convenio;
  END IF;

  -- ── Coletar horas já ocupadas (médico + data) ──
  SELECT array_agg(a.hora_agendamento) INTO v_occupied_horas
    FROM public.agendamentos a
   WHERE a.medico_id        = p_medico_id
     AND a.data_agendamento = p_data_agendamento
     AND a.status           IN ('agendado', 'confirmado')
     AND a.excluido_em      IS NULL
     AND a.cancelado_em     IS NULL;

  IF v_occupied_horas IS NULL THEN
    v_occupied_horas := '{}';
  END IF;

  -- ── Buscar N slots livres a partir de p_hora_agendamento ──
  -- Incremento de 1 minuto; pula horas ocupadas; não assume continuidade.
  v_candidate := p_hora_agendamento;

  WHILE array_length(v_free_slots, 1) IS DISTINCT FROM v_n_exames
    AND v_iterations < v_max_iterations
  LOOP
    IF NOT (v_candidate = ANY(v_occupied_horas)) THEN
      v_free_slots := array_append(v_free_slots, v_candidate);
    END IF;
    v_candidate  := v_candidate + interval '1 minute';
    v_iterations := v_iterations + 1;
  END LOOP;

  IF array_length(v_free_slots, 1) IS DISTINCT FROM v_n_exames THEN
    RAISE EXCEPTION
      'Não há horários livres suficientes para % exame(s) a partir das % nesta data. '
      'Tente um horário inicial diferente.',
      v_n_exames,
      to_char(p_hora_agendamento, 'HH24:MI');
  END IF;

  -- ── Buscar ou criar paciente ──
  SELECT id INTO v_paciente_id
    FROM public.pacientes
   WHERE LOWER(TRIM(nome_completo)) = LOWER(TRIM(p_nome_completo))
     AND data_nascimento = p_data_nascimento
     AND convenio        = p_convenio
     AND cliente_id      = v_cliente_id
   LIMIT 1;

  IF v_paciente_id IS NULL THEN
    INSERT INTO public.pacientes
      (nome_completo, data_nascimento, convenio, telefone, celular, cliente_id)
    VALUES
      (UPPER(TRIM(p_nome_completo)), p_data_nascimento, p_convenio,
       p_telefone, COALESCE(p_celular, ''), v_cliente_id)
    RETURNING id INTO v_paciente_id;
  END IF;

  -- ── Inserir todos os exames, cada um com seu slot livre ──
  -- Sem EXCEPTION WHEN OTHERS: qualquer falha faz rollback automático de tudo.
  v_slot_idx := 1;
  FOR v_atendimento_id IN SELECT unnest(p_atendimento_ids) LOOP
    INSERT INTO public.agendamentos (
      paciente_id, medico_id, atendimento_id,
      data_agendamento, hora_agendamento,
      convenio, observacoes, criado_por, criado_por_user_id,
      status, cliente_id
    ) VALUES (
      v_paciente_id, p_medico_id, v_atendimento_id,
      p_data_agendamento, v_free_slots[v_slot_idx],
      p_convenio,
      COALESCE(v_combined_obs, '') || COALESCE(v_age_note, ''),
      p_criado_por, p_criado_por_user_id,
      'agendado', v_cliente_id
    ) RETURNING id INTO v_current_agend_id;

    v_agendamento_ids := array_append(v_agendamento_ids, v_current_agend_id);
    v_slot_idx := v_slot_idx + 1;
  END LOOP;

  RETURN json_build_object(
    'success',             true,
    'agendamento_ids',     v_agendamento_ids,
    'paciente_id',         v_paciente_id,
    'total_agendamentos',  array_length(v_agendamento_ids, 1),
    'atendimentos',        v_atendimento_names,
    'horarios_atribuidos', v_free_slots,
    'message', format(
      '%s exame(s) agendado(s) nos próximos horários disponíveis a partir das %s',
      array_length(v_agendamento_ids, 1),
      to_char(p_hora_agendamento, 'HH24:MI')
    )
  );
END;
$$;
