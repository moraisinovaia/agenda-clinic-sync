-- #4 + #9: Adiciona validações de negócio e corrige conflict check na criar_agendamento_atomico
--
-- Problema 1 (#9): conflict check não filtra excluido_em IS NULL → agendamentos soft-deleted
--   com status='agendado' bloqueavam novos slots silenciosamente.
--
-- Problema 2 (#4): a RPC não validava convênio, bloqueios de agenda nem idade.
--   A variante _externo já tinha essas validações; a _atomico (usada pelo frontend
--   e pelo scheduling-api) ficava sem proteção.
--
-- Mudanças:
--   1. SELECT do médico expandido para incluir convenios_aceitos, idade_minima, idade_maxima
--   2. Após validação do médico:
--      a. Bloqueio de agenda (bloqueios_agenda) — rejeita se data cai em período bloqueado
--      b. Convênio — rejeita se doctor.convenios_aceitos está preenchido e convênio não está na lista
--      c. Idade — não bloqueia, apenas anexa nota em observacoes (consistente com _externo)
--   3. Conflict check: adicionado AND excluido_em IS NULL

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

  -- 2. Verificar médico: ativo, cliente_id e dados de validação
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

  -- 3a. Verificar bloqueios de agenda
  SELECT COUNT(*) INTO v_blocked_count
  FROM bloqueios_agenda
  WHERE medico_id  = p_medico_id
    AND cliente_id = v_cliente_id
    AND status     = 'ativo'
    AND p_data_agendamento::date BETWEEN data_inicio AND data_fim;

  IF v_blocked_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A agenda está bloqueada nesta data');
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

  -- 4. Verificar conflito de horário (#9: +excluido_em IS NULL)
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
        'success',          false,
        'error',            'CONFLICT',
        'conflict_detected', true,
        'message',          format(
          'Já existe um agendamento para %s neste horário (%s às %s). Paciente: %s. Deseja agendar mesmo assim?',
          to_char(p_data_agendamento::date, 'DD/MM/YYYY'),
          p_hora_agendamento, p_hora_agendamento,
          COALESCE(v_conflict_paciente, 'Desconhecido')
        ),
        'conflict_details', jsonb_build_object(
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
    'success',         true,
    'agendamento_id',  v_agendamento_id,
    'paciente_id',     v_paciente_id,
    'is_editing',      v_is_editing,
    'criado_por_usado', p_criado_por
  );

  IF array_length(v_warnings, 1) > 0 THEN
    v_result := v_result || jsonb_build_object('warnings', to_jsonb(v_warnings));
  END IF;

  RETURN v_result;
END;
$$;
