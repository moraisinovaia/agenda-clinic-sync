-- Atualiza verificação de bloqueio nas 3 RPCs de agendamento para suportar
-- bloqueio parcial por horário (hora_inicio / hora_fim).
--
-- Regra:
--   hora_inicio IS NULL → bloqueia o dia inteiro (comportamento original)
--   hora_inicio IS NOT NULL → intervalo semiaberto: hora >= hora_inicio AND hora < hora_fim

-- ═══════════════════════════════════════════════════════════════
-- 1. criar_agendamento_atomico  (frontend principal)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.criar_agendamento_atomico(
  p_nome_completo         TEXT,
  p_data_nascimento       TEXT    DEFAULT NULL,
  p_convenio              TEXT    DEFAULT 'Particular',
  p_telefone              TEXT    DEFAULT NULL,
  p_celular               TEXT    DEFAULT NULL,
  p_medico_id             UUID    DEFAULT NULL,
  p_atendimento_id        UUID    DEFAULT NULL,
  p_data_agendamento      TEXT    DEFAULT NULL,
  p_hora_agendamento      TEXT    DEFAULT NULL,
  p_observacoes           TEXT    DEFAULT NULL,
  p_criado_por            TEXT    DEFAULT 'Sistema',
  p_criado_por_user_id    UUID    DEFAULT NULL,
  p_agendamento_id_edicao UUID    DEFAULT NULL,
  p_force_conflict        BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id          UUID;
  v_agendamento_id       UUID;
  v_cliente_id           UUID;
  v_medico_ativo         BOOLEAN;
  v_convenios_aceitos    TEXT[];
  v_idade_minima         INTEGER;
  v_idade_maxima         INTEGER;
  v_conflict_exists      BOOLEAN := FALSE;
  v_conflict_paciente    TEXT;
  v_is_editing           BOOLEAN := (p_agendamento_id_edicao IS NOT NULL);
  v_warnings             TEXT[]  := ARRAY[]::TEXT[];
  v_result               JSONB;
  v_convenio_normalizado TEXT;
  v_patient_age          INTEGER;
  v_age_note             TEXT    := '';
  v_blocked_count        INTEGER;
  v_obs_final            TEXT;
BEGIN
  -- 1. Validações básicas
  IF p_nome_completo IS NULL OR trim(p_nome_completo) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome completo é obrigatório');
  END IF;

  IF p_medico_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Médico é obrigatório');
  END IF;

  IF p_atendimento_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tipo de atendimento é obrigatório');
  END IF;

  IF p_data_agendamento IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Data do agendamento é obrigatória');
  END IF;

  IF p_hora_agendamento IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hora do agendamento é obrigatória');
  END IF;

  -- 2. Verificar médico
  SELECT ativo, cliente_id, convenios_aceitos, idade_minima, idade_maxima
  INTO v_medico_ativo, v_cliente_id, v_convenios_aceitos, v_idade_minima, v_idade_maxima
  FROM medicos
  WHERE id = p_medico_id;

  IF v_medico_ativo IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Médico não encontrado');
  END IF;

  IF NOT v_medico_ativo THEN
    RETURN jsonb_build_object('success', false, 'error', 'Médico não está ativo');
  END IF;

  -- 2b. Validar par (medico, atendimento) via pivot M:N
  IF NOT validar_par_medico_atendimento(p_medico_id, p_atendimento_id, v_cliente_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Este tipo de atendimento não está vinculado a este médico'
    );
  END IF;

  -- 3a. Verificar bloqueios de agenda
  --     NULL em hora_inicio → bloqueia dia inteiro.
  --     Intervalo semiaberto: hora >= hora_inicio AND hora < hora_fim.
  SELECT COUNT(*) INTO v_blocked_count
  FROM bloqueios_agenda
  WHERE medico_id  = p_medico_id
    AND cliente_id = v_cliente_id
    AND status     = 'ativo'
    AND p_data_agendamento::date >= data_inicio
    AND p_data_agendamento::date <= data_fim
    AND (
      hora_inicio IS NULL
      OR (
        p_hora_agendamento::time >= hora_inicio
        AND p_hora_agendamento::time < hora_fim
      )
    );

  IF v_blocked_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A agenda está bloqueada neste horário');
  END IF;

  -- 3b. Validar convênio aceito pelo médico
  IF v_convenios_aceitos IS NOT NULL AND array_length(v_convenios_aceitos, 1) > 0 THEN
    v_convenio_normalizado := regexp_replace(upper(trim(COALESCE(p_convenio, ''))), '[^A-Z0-9]+', '', 'g');
    IF NOT EXISTS (
      SELECT 1
      FROM unnest(v_convenios_aceitos) AS c
      WHERE regexp_replace(upper(trim(c)), '[^A-Z0-9]+', '', 'g') = v_convenio_normalizado
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error',   format('Convênio "%s" não é aceito por este médico', p_convenio)
      );
    END IF;
  END IF;

  -- 3c. Validar idade (não bloqueia — registra nota em observacoes)
  IF p_data_nascimento IS NOT NULL AND p_data_nascimento != '' THEN
    v_patient_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_data_nascimento::date))::INTEGER;

    IF v_idade_minima IS NOT NULL AND v_patient_age < v_idade_minima THEN
      v_age_note := v_age_note || format(
        ' [ATENÇÃO: idade %s anos abaixo do padrão mínimo %s anos]', v_patient_age, v_idade_minima
      );
    END IF;

    IF v_idade_maxima IS NOT NULL AND v_patient_age > v_idade_maxima THEN
      v_age_note := v_age_note || format(
        ' [ATENÇÃO: idade %s anos acima do padrão máximo %s anos]', v_patient_age, v_idade_maxima
      );
    END IF;

    IF v_age_note != '' THEN
      v_warnings := array_append(v_warnings, trim(v_age_note));
    END IF;
  END IF;

  -- 4. Verificar conflito de horário
  IF NOT p_force_conflict THEN
    SELECT EXISTS(
      SELECT 1 FROM agendamentos
      WHERE medico_id        = p_medico_id
        AND data_agendamento = p_data_agendamento::date
        AND hora_agendamento = p_hora_agendamento::time
        AND status           IN ('agendado', 'confirmado')
        AND excluido_em      IS NULL
        AND (NOT v_is_editing OR id != p_agendamento_id_edicao)
        AND cliente_id       = v_cliente_id
    ) INTO v_conflict_exists;

    IF v_conflict_exists THEN
      SELECT p.nome_completo INTO v_conflict_paciente
      FROM agendamentos a
      JOIN pacientes p ON p.id = a.paciente_id
      WHERE a.medico_id        = p_medico_id
        AND a.data_agendamento = p_data_agendamento::date
        AND a.hora_agendamento = p_hora_agendamento::time
        AND a.status           IN ('agendado', 'confirmado')
        AND a.excluido_em      IS NULL
        AND a.cliente_id       = v_cliente_id
        AND (NOT v_is_editing OR a.id != p_agendamento_id_edicao)
      LIMIT 1;

      RETURN jsonb_build_object(
        'success',           false,
        'error',             'CONFLICT',
        'conflict_detected', true,
        'message',           format(
          'Já existe um agendamento para %s neste horário (%s às %s). Paciente: %s. Deseja agendar mesmo assim?',
          to_char(p_data_agendamento::date, 'DD/MM/YYYY'),
          p_hora_agendamento, p_hora_agendamento,
          COALESCE(v_conflict_paciente, 'Desconhecido')
        ),
        'conflict_details',  jsonb_build_object(
          'paciente_conflito', v_conflict_paciente,
          'data',              p_data_agendamento,
          'hora',              p_hora_agendamento
        )
      );
    END IF;
  END IF;

  -- 5. Buscar ou criar paciente
  SELECT id INTO v_paciente_id
  FROM pacientes
  WHERE cliente_id = v_cliente_id
    AND lower(trim(nome_completo)) = lower(trim(p_nome_completo))
    AND (
      (p_data_nascimento IS NOT NULL AND p_data_nascimento != ''
         AND data_nascimento = p_data_nascimento::date)
      OR (
        (p_data_nascimento IS NULL OR p_data_nascimento = '')
        AND data_nascimento IS NULL
      )
    )
  LIMIT 1;

  IF v_paciente_id IS NULL THEN
    INSERT INTO pacientes (nome_completo, data_nascimento, convenio, telefone, celular, cliente_id)
    VALUES (
      trim(p_nome_completo),
      CASE WHEN p_data_nascimento IS NOT NULL AND p_data_nascimento != ''
           THEN p_data_nascimento::date ELSE NULL END,
      COALESCE(p_convenio, 'Particular'),
      p_telefone,
      p_celular,
      v_cliente_id
    )
    ON CONFLICT (cliente_id, lower(TRIM(BOTH FROM (nome_completo)::text)), data_nascimento)
    WHERE data_nascimento IS NOT NULL
    DO UPDATE SET
      convenio   = COALESCE(EXCLUDED.convenio,  pacientes.convenio),
      celular    = COALESCE(EXCLUDED.celular,    pacientes.celular),
      telefone   = COALESCE(EXCLUDED.telefone,   pacientes.telefone),
      updated_at = now()
    RETURNING id INTO v_paciente_id;

    IF v_paciente_id IS NULL THEN
      SELECT id INTO v_paciente_id
      FROM pacientes
      WHERE cliente_id = v_cliente_id
        AND lower(trim(nome_completo)) = lower(trim(p_nome_completo))
        AND data_nascimento IS NULL
      LIMIT 1;

      IF v_paciente_id IS NULL THEN
        INSERT INTO pacientes (nome_completo, data_nascimento, convenio, telefone, celular, cliente_id)
        VALUES (trim(p_nome_completo), NULL, COALESCE(p_convenio, 'Particular'), p_telefone, p_celular, v_cliente_id)
        RETURNING id INTO v_paciente_id;
      END IF;
    END IF;
  ELSE
    UPDATE pacientes SET
      convenio   = COALESCE(p_convenio,  convenio),
      celular    = COALESCE(p_celular,   celular),
      telefone   = COALESCE(p_telefone,  telefone),
      updated_at = now()
    WHERE id = v_paciente_id;
  END IF;

  -- 6. Criar ou editar agendamento
  v_obs_final := CASE
    WHEN v_age_note != '' THEN
      trim(COALESCE(p_observacoes, '') || ' ' || v_age_note)
    ELSE
      p_observacoes
  END;

  IF v_is_editing THEN
    UPDATE agendamentos SET
      paciente_id            = v_paciente_id,
      medico_id              = p_medico_id,
      atendimento_id         = p_atendimento_id,
      data_agendamento       = p_data_agendamento::date,
      hora_agendamento       = p_hora_agendamento::time,
      observacoes            = v_obs_final,
      convenio               = COALESCE(p_convenio, 'Particular'),
      criado_por             = p_criado_por,
      criado_por_user_id     = p_criado_por_user_id,
      alterado_por_user_id   = p_criado_por_user_id,
      updated_at             = now()
    WHERE id         = p_agendamento_id_edicao
      AND cliente_id = v_cliente_id;

    v_agendamento_id := p_agendamento_id_edicao;
  ELSE
    INSERT INTO agendamentos (
      paciente_id, medico_id, atendimento_id,
      data_agendamento, hora_agendamento,
      observacoes, convenio, criado_por, criado_por_user_id,
      status, cliente_id
    ) VALUES (
      v_paciente_id, p_medico_id, p_atendimento_id,
      p_data_agendamento::date, p_hora_agendamento::time,
      v_obs_final, COALESCE(p_convenio, 'Particular'), p_criado_por, p_criado_por_user_id,
      'agendado', v_cliente_id
    )
    RETURNING id INTO v_agendamento_id;
  END IF;

  -- 7. Retornar sucesso
  v_result := jsonb_build_object(
    'success',          true,
    'agendamento_id',   v_agendamento_id,
    'paciente_id',      v_paciente_id,
    'is_editing',       v_is_editing,
    'criado_por_usado', p_criado_por
  );

  IF array_length(v_warnings, 1) > 0 THEN
    v_result := v_result || jsonb_build_object('warnings', to_jsonb(v_warnings));
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_agendamento_atomico(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, UUID, BOOLEAN)
  TO authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════
-- 2. criar_agendamento_atomico_externo  (WhatsApp / LLM Agent)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.criar_agendamento_atomico_externo(
  p_cliente_id         UUID,
  p_nome_completo      TEXT,
  p_data_nascimento    DATE,
  p_convenio           TEXT,
  p_telefone           TEXT,
  p_celular            TEXT,
  p_medico_id          UUID,
  p_atendimento_id     UUID,
  p_data_agendamento   DATE,
  p_hora_agendamento   TIME,
  p_observacoes        TEXT    DEFAULT NULL,
  p_criado_por         TEXT    DEFAULT 'llm-agent',
  p_force_conflict     BOOLEAN DEFAULT FALSE,
  p_idempotency_key    TEXT    DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id          UUID;
  v_agendamento_id       UUID;
  v_conflict_check       INTEGER;
  v_doctor_record        RECORD;
  v_patient_age          INTEGER;
  v_blocked_check        INTEGER;
  v_age_note             TEXT := '';
  v_convenio_normalizado TEXT;
BEGIN
  -- Validações obrigatórias
  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'cliente_id é obrigatório';
  END IF;

  IF p_medico_id IS NULL THEN
    RAISE EXCEPTION 'Médico é obrigatório';
  END IF;

  IF p_atendimento_id IS NULL THEN
    RAISE EXCEPTION 'Atendimento é obrigatório';
  END IF;

  IF p_data_agendamento IS NULL OR p_hora_agendamento IS NULL THEN
    RAISE EXCEPTION 'Data e hora são obrigatórias';
  END IF;

  -- Normalizar convênio para comparação
  v_convenio_normalizado := regexp_replace(upper(trim(p_convenio)), '[^A-Z0-9%]+', '', 'g');

  -- Buscar médico
  SELECT m.*, m.ativo, m.idade_minima, m.idade_maxima, m.convenios_aceitos
  INTO v_doctor_record
  FROM public.medicos m
  WHERE m.id = p_medico_id
    AND m.cliente_id = p_cliente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Médico não encontrado';
  END IF;

  IF NOT v_doctor_record.ativo THEN
    RAISE EXCEPTION 'Médico não está ativo';
  END IF;

  -- Validar par (medico, atendimento) via pivot M:N
  IF NOT validar_par_medico_atendimento(p_medico_id, p_atendimento_id, p_cliente_id) THEN
    RAISE EXCEPTION 'Este tipo de atendimento não está vinculado a este médico';
  END IF;

  -- Verificar bloqueios de agenda
  --   NULL em hora_inicio → bloqueia dia inteiro.
  --   Intervalo semiaberto: hora >= hora_inicio AND hora < hora_fim.
  SELECT COUNT(*)
  INTO v_blocked_check
  FROM public.bloqueios_agenda
  WHERE medico_id  = p_medico_id
    AND cliente_id = p_cliente_id
    AND status     = 'ativo'
    AND p_data_agendamento >= data_inicio
    AND p_data_agendamento <= data_fim
    AND (
      hora_inicio IS NULL
      OR (
        p_hora_agendamento >= hora_inicio
        AND p_hora_agendamento < hora_fim
      )
    );

  IF v_blocked_check > 0 THEN
    RAISE EXCEPTION 'A agenda está bloqueada neste horário';
  END IF;

  -- Validar data/hora não seja no passado
  IF (p_data_agendamento::timestamp + p_hora_agendamento) < (now() - interval '1 hour') THEN
    RAISE EXCEPTION 'Não é possível agendar para uma data/hora que já passou';
  END IF;

  -- Verificar conflito de horário
  IF NOT p_force_conflict THEN
    SELECT COUNT(*)
    INTO v_conflict_check
    FROM public.agendamentos
    WHERE medico_id        = p_medico_id
      AND cliente_id       = p_cliente_id
      AND data_agendamento = p_data_agendamento
      AND hora_agendamento = p_hora_agendamento
      AND status           IN ('agendado', 'confirmado')
      AND excluido_em      IS NULL;

    IF v_conflict_check > 0 THEN
      RETURN json_build_object(
        'success',          false,
        'error',            'CONFLICT',
        'message',          'Este horário já está agendado para este médico',
        'data_agendamento', p_data_agendamento,
        'hora_agendamento', p_hora_agendamento
      );
    END IF;
  END IF;

  -- Calcular idade
  IF p_data_nascimento IS NOT NULL THEN
    SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_data_nascimento))::INTEGER
    INTO v_patient_age;

    IF v_doctor_record.idade_minima IS NOT NULL AND v_patient_age < v_doctor_record.idade_minima THEN
      v_age_note := v_age_note || format(
        ' [Idade %s anos - abaixo do padrão %s anos]', v_patient_age, v_doctor_record.idade_minima
      );
    END IF;

    IF v_doctor_record.idade_maxima IS NOT NULL AND v_patient_age > v_doctor_record.idade_maxima THEN
      v_age_note := v_age_note || format(
        ' [Idade %s anos - acima do padrão %s anos]', v_patient_age, v_doctor_record.idade_maxima
      );
    END IF;
  END IF;

  -- Validar convênio aceito pelo médico
  IF v_doctor_record.convenios_aceitos IS NOT NULL AND
     array_length(v_doctor_record.convenios_aceitos, 1) > 0 THEN
    IF NOT EXISTS (
      SELECT 1
      FROM unnest(v_doctor_record.convenios_aceitos) AS convenio
      WHERE regexp_replace(upper(trim(convenio)), '[^A-Z0-9%]+', '', 'g') = v_convenio_normalizado
    ) THEN
      RAISE EXCEPTION 'Convênio "%" não é aceito por este médico', p_convenio;
    END IF;
  END IF;

  -- Buscar ou criar paciente
  SELECT id INTO v_paciente_id
  FROM public.pacientes
  WHERE cliente_id = p_cliente_id
    AND lower(trim(nome_completo)) = lower(trim(p_nome_completo))
    AND (
      (p_data_nascimento IS NOT NULL AND data_nascimento = p_data_nascimento)
      OR
      (p_data_nascimento IS NULL AND data_nascimento IS NULL)
    )
  LIMIT 1;

  IF v_paciente_id IS NOT NULL THEN
    UPDATE public.pacientes SET
      convenio   = COALESCE(p_convenio,  convenio),
      celular    = COALESCE(p_celular,   celular),
      telefone   = COALESCE(p_telefone,  telefone),
      updated_at = now()
    WHERE id = v_paciente_id;
  ELSE
    INSERT INTO public.pacientes (
      nome_completo, data_nascimento, convenio, telefone, celular, cliente_id
    ) VALUES (
      upper(trim(p_nome_completo)),
      p_data_nascimento,
      upper(trim(p_convenio)),
      p_telefone,
      COALESCE(p_celular, ''),
      p_cliente_id
    )
    ON CONFLICT (cliente_id, lower(TRIM(BOTH FROM nome_completo::text)), data_nascimento)
    WHERE data_nascimento IS NOT NULL
    DO UPDATE SET
      convenio   = COALESCE(EXCLUDED.convenio,  pacientes.convenio),
      celular    = COALESCE(EXCLUDED.celular,   pacientes.celular),
      telefone   = COALESCE(EXCLUDED.telefone,  pacientes.telefone),
      updated_at = now()
    RETURNING id INTO v_paciente_id;

    IF v_paciente_id IS NULL THEN
      SELECT id INTO v_paciente_id
      FROM public.pacientes
      WHERE cliente_id = p_cliente_id
        AND lower(trim(nome_completo)) = lower(trim(p_nome_completo))
        AND (
          (p_data_nascimento IS NOT NULL AND data_nascimento = p_data_nascimento)
          OR
          (p_data_nascimento IS NULL AND data_nascimento IS NULL)
        )
      LIMIT 1;
    END IF;
  END IF;

  -- Criar agendamento
  INSERT INTO public.agendamentos (
    paciente_id, medico_id, atendimento_id, data_agendamento, hora_agendamento,
    convenio, observacoes, criado_por, status, cliente_id, idempotency_key
  ) VALUES (
    v_paciente_id,
    p_medico_id,
    p_atendimento_id,
    p_data_agendamento,
    p_hora_agendamento,
    upper(trim(p_convenio)),
    COALESCE(p_observacoes, '') || COALESCE(v_age_note, ''),
    p_criado_por,
    'agendado',
    p_cliente_id,
    p_idempotency_key
  ) RETURNING id INTO v_agendamento_id;

  RETURN json_build_object(
    'success',        true,
    'agendamento_id', v_agendamento_id,
    'paciente_id',    v_paciente_id,
    'message',        CASE WHEN v_age_note != ''
                        THEN 'Agendamento criado com observações de idade'
                        ELSE 'Agendamento criado com sucesso'
                      END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error',   SQLERRM,
      'message', 'Erro ao criar agendamento: ' || SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_agendamento_atomico_externo(UUID, TEXT, DATE, TEXT, TEXT, TEXT, UUID, UUID, DATE, TIME, TEXT, TEXT, BOOLEAN, TEXT)
  TO authenticated, service_role, anon;


-- ═══════════════════════════════════════════════════════════════
-- 3. criar_agendamento_multiplo  (múltiplos exames)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.criar_agendamento_multiplo(
  p_nome_completo      TEXT,
  p_data_nascimento    DATE,
  p_convenio           TEXT,
  p_telefone           TEXT,
  p_celular            TEXT,
  p_medico_id          UUID,
  p_atendimento_ids    UUID[],
  p_data_agendamento   DATE,
  p_hora_agendamento   TIME,
  p_observacoes        TEXT    DEFAULT NULL,
  p_criado_por         TEXT    DEFAULT 'Sistema',
  p_criado_por_user_id UUID    DEFAULT NULL
)
RETURNS JSON
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
  v_max_iterations      integer  := 1440;
  v_slot_idx            integer  := 1;
BEGIN
  -- Advisory lock: serializa inserções para mesmo médico + data
  PERFORM pg_advisory_xact_lock(
    hashtext(p_medico_id::text || p_data_agendamento::text)
  );

  -- Tenant
  v_cliente_id := get_user_cliente_id();
  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem cliente_id — contacte o administrador';
  END IF;

  v_n_exames := array_length(p_atendimento_ids, 1);
  IF v_n_exames IS NULL OR v_n_exames = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos um atendimento';
  END IF;

  -- Nomes dos atendimentos
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

  -- Validar médico
  SELECT m.* INTO v_doctor_record
    FROM public.medicos m WHERE m.id = p_medico_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Médico não encontrado';
  END IF;
  IF NOT v_doctor_record.ativo THEN
    RAISE EXCEPTION 'Médico não está ativo';
  END IF;

  -- Verificar bloqueios de agenda
  --   NULL em hora_inicio → bloqueia dia inteiro.
  --   Intervalo semiaberto: hora >= hora_inicio AND hora < hora_fim.
  SELECT COUNT(*) INTO v_blocked_check
    FROM public.bloqueios_agenda
   WHERE medico_id  = p_medico_id
     AND cliente_id = v_cliente_id
     AND status     = 'ativo'
     AND p_data_agendamento >= data_inicio
     AND p_data_agendamento <= data_fim
     AND (
       hora_inicio IS NULL
       OR (
         p_hora_agendamento >= hora_inicio
         AND p_hora_agendamento < hora_fim
       )
     );
  IF v_blocked_check > 0 THEN
    RAISE EXCEPTION 'A agenda está bloqueada neste horário';
  END IF;

  -- Validar data/hora no passado
  IF (p_data_agendamento::timestamp + p_hora_agendamento) < (now() - interval '1 hour') THEN
    RAISE EXCEPTION 'Não é possível agendar para uma data/hora que já passou';
  END IF;

  -- Validar idade
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

  -- Validar convênio
  IF v_doctor_record.convenios_aceitos IS NOT NULL
     AND array_length(v_doctor_record.convenios_aceitos, 1) > 0
     AND NOT (p_convenio = ANY(v_doctor_record.convenios_aceitos)) THEN
    RAISE EXCEPTION 'Convênio "%" não é aceito por este médico', p_convenio;
  END IF;

  -- Coletar horas já ocupadas (médico + data)
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

  -- Buscar N slots livres a partir de p_hora_agendamento
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

  -- Buscar ou criar paciente
  SELECT id INTO v_paciente_id
    FROM public.pacientes
   WHERE cliente_id = v_cliente_id
     AND lower(trim(nome_completo)) = lower(trim(p_nome_completo))
     AND (
       (p_data_nascimento IS NOT NULL AND data_nascimento = p_data_nascimento)
       OR (p_data_nascimento IS NULL AND data_nascimento IS NULL)
     )
   LIMIT 1;

  IF v_paciente_id IS NULL THEN
    INSERT INTO public.pacientes
      (nome_completo, data_nascimento, convenio, telefone, celular, cliente_id)
    VALUES
      (trim(p_nome_completo), p_data_nascimento, p_convenio,
       p_telefone, COALESCE(p_celular, ''), v_cliente_id)
    ON CONFLICT (cliente_id, lower(TRIM(BOTH FROM (nome_completo)::text)), data_nascimento)
    WHERE data_nascimento IS NOT NULL
    DO UPDATE SET
      convenio   = COALESCE(EXCLUDED.convenio,  pacientes.convenio),
      celular    = COALESCE(EXCLUDED.celular,    pacientes.celular),
      telefone   = COALESCE(EXCLUDED.telefone,   pacientes.telefone),
      updated_at = now()
    RETURNING id INTO v_paciente_id;

    IF v_paciente_id IS NULL THEN
      SELECT id INTO v_paciente_id
        FROM public.pacientes
       WHERE cliente_id = v_cliente_id
         AND lower(trim(nome_completo)) = lower(trim(p_nome_completo))
         AND data_nascimento IS NULL
       LIMIT 1;

      IF v_paciente_id IS NULL THEN
        INSERT INTO public.pacientes
          (nome_completo, data_nascimento, convenio, telefone, celular, cliente_id)
        VALUES
          (trim(p_nome_completo), NULL, p_convenio,
           p_telefone, COALESCE(p_celular, ''), v_cliente_id)
        RETURNING id INTO v_paciente_id;
      END IF;
    END IF;
  END IF;

  -- Inserir todos os exames, cada um com seu slot livre
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

GRANT EXECUTE ON FUNCTION public.criar_agendamento_multiplo(TEXT, DATE, TEXT, TEXT, TEXT, UUID, UUID[], DATE, TIME, TEXT, TEXT, UUID)
  TO authenticated, service_role;

