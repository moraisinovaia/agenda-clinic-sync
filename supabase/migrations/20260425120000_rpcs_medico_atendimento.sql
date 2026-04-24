-- RPCs para o modelo M:N medico_atendimento.
--
-- Novas: get_atendimentos_por_medico, upsert_medico_atendimento_valor
-- Atualizadas: criar_medico, atualizar_medico (pivot em vez de UPDATE direto)
-- Validação adicionada em: criar_agendamento_atomico, criar_agendamento_atomico_externo

-- ═══════════════════════════════════════════════════════════════
-- 1. get_atendimentos_por_medico
--    Retorna serviços vinculados ao médico via pivot, com preço efetivo.
--    valor_efetivo = COALESCE(valor_override, valor_particular)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_atendimentos_por_medico(
  p_medico_id  UUID,
  p_cliente_id UUID
)
RETURNS TABLE (
  id                       UUID,
  nome                     TEXT,
  tipo                     TEXT,
  codigo                   TEXT,
  valor_particular         NUMERIC,
  valor_efetivo            NUMERIC,
  coparticipacao_unimed_20 NUMERIC,
  coparticipacao_unimed_40 NUMERIC,
  forma_pagamento          TEXT,
  observacoes              TEXT,
  restricoes               TEXT,
  ativo                    BOOLEAN,
  valor_override           NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    a.id,
    a.nome::TEXT,
    a.tipo::TEXT,
    a.codigo::TEXT,
    a.valor_particular,
    COALESCE(ma.valor_override, a.valor_particular) AS valor_efetivo,
    a.coparticipacao_unimed_20,
    a.coparticipacao_unimed_40,
    a.forma_pagamento::TEXT,
    a.observacoes::TEXT,
    a.restricoes::TEXT,
    a.ativo,
    ma.valor_override
  FROM public.medico_atendimento ma
  JOIN public.atendimentos a ON a.id = ma.atendimento_id
  WHERE ma.medico_id  = p_medico_id
    AND ma.cliente_id = p_cliente_id
    AND ma.ativo      = true
    AND a.ativo       = true
  ORDER BY a.nome;
$$;

GRANT EXECUTE ON FUNCTION public.get_atendimentos_por_medico(UUID, UUID)
  TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════
-- 2. upsert_medico_atendimento_valor
--    Define ou atualiza o valor_override para um par médico+serviço.
--    Passar p_valor_override = NULL remove o override (volta ao padrão).
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.upsert_medico_atendimento_valor(
  p_medico_id      UUID,
  p_atendimento_id UUID,
  p_valor_override NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id UUID;
BEGIN
  -- Buscar cliente_id pelo médico para garantir isolamento de tenant
  SELECT cliente_id INTO v_cliente_id
  FROM public.medicos
  WHERE id = p_medico_id;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Médico não encontrado');
  END IF;

  -- Verificar que o atendimento pertence ao mesmo cliente
  IF NOT EXISTS (
    SELECT 1 FROM public.atendimentos
    WHERE id = p_atendimento_id AND cliente_id = v_cliente_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Atendimento não encontrado nesta clínica');
  END IF;

  INSERT INTO public.medico_atendimento
    (medico_id, atendimento_id, cliente_id, valor_override, ativo)
  VALUES
    (p_medico_id, p_atendimento_id, v_cliente_id, p_valor_override, true)
  ON CONFLICT (medico_id, atendimento_id) DO UPDATE
    SET valor_override = EXCLUDED.valor_override,
        ativo          = true,
        updated_at     = now();

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_medico_atendimento_valor(UUID, UUID, NUMERIC)
  TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════
-- 3. criar_medico — usar pivot em vez de UPDATE direto em atendimentos
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.criar_medico(
  p_cliente_id       UUID,
  p_nome             TEXT,
  p_especialidade    TEXT,
  p_convenios_aceitos TEXT[]  DEFAULT NULL,
  p_idade_minima     INTEGER  DEFAULT NULL,
  p_idade_maxima     INTEGER  DEFAULT NULL,
  p_observacoes      TEXT     DEFAULT NULL,
  p_atendimentos_ids UUID[]   DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_medico_id UUID;
BEGIN
  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'cliente_id é obrigatório';
  END IF;
  IF p_nome IS NULL OR trim(p_nome) = '' THEN
    RAISE EXCEPTION 'Nome do médico é obrigatório';
  END IF;
  IF p_especialidade IS NULL OR trim(p_especialidade) = '' THEN
    RAISE EXCEPTION 'Especialidade é obrigatória';
  END IF;

  INSERT INTO public.medicos (
    cliente_id, nome, especialidade, convenios_aceitos,
    idade_minima, idade_maxima, observacoes, ativo
  ) VALUES (
    p_cliente_id,
    trim(p_nome),
    trim(p_especialidade),
    p_convenios_aceitos,
    COALESCE(p_idade_minima, 0),
    p_idade_maxima,
    p_observacoes,
    true
  ) RETURNING id INTO v_medico_id;

  -- Vincular atendimentos via pivot (sem tocar em atendimentos.medico_id)
  IF p_atendimentos_ids IS NOT NULL AND array_length(p_atendimentos_ids, 1) > 0 THEN
    INSERT INTO public.medico_atendimento (medico_id, atendimento_id, cliente_id, ativo)
    SELECT v_medico_id, unnest(p_atendimentos_ids), p_cliente_id, true
    -- Ignorar IDs que não pertencem ao cliente (segurança)
    WHERE unnest(p_atendimentos_ids) IN (
      SELECT id FROM public.atendimentos WHERE cliente_id = p_cliente_id
    )
    ON CONFLICT (medico_id, atendimento_id) DO NOTHING;
  END IF;

  RETURN json_build_object(
    'success', true,
    'medico_id', v_medico_id,
    'message', 'Médico criado com sucesso'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Erro ao criar médico: ' || SQLERRM
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 4. atualizar_medico — usar pivot em vez de UPDATE direto
-- ═══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.atualizar_medico(uuid, jsonb, uuid[]);
DROP FUNCTION IF EXISTS public.atualizar_medico(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.atualizar_medico(
  p_medico_id        UUID,
  p_dados            JSONB,
  p_atendimentos_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id UUID;
BEGIN
  SELECT cliente_id INTO v_cliente_id
  FROM public.medicos
  WHERE id = p_medico_id;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Médico não encontrado');
  END IF;

  -- Atualizar campos do médico
  UPDATE public.medicos SET
    nome                 = COALESCE(p_dados->>'nome', nome),
    especialidade        = COALESCE(p_dados->>'especialidade', especialidade),
    ativo                = COALESCE((p_dados->>'ativo')::boolean, ativo),
    convenios_aceitos    = CASE WHEN p_dados ? 'convenios_aceitos'
                             THEN ARRAY(SELECT jsonb_array_elements_text(p_dados->'convenios_aceitos'))
                             ELSE convenios_aceitos END,
    idade_minima         = COALESCE((p_dados->>'idade_minima')::integer, idade_minima),
    idade_maxima         = CASE WHEN p_dados ? 'idade_maxima'
                             THEN (p_dados->>'idade_maxima')::integer
                             ELSE idade_maxima END,
    observacoes          = CASE WHEN p_dados ? 'observacoes'
                             THEN p_dados->>'observacoes' ELSE observacoes END,
    crm                  = CASE WHEN p_dados ? 'crm'
                             THEN p_dados->>'crm' ELSE crm END,
    rqe                  = CASE WHEN p_dados ? 'rqe'
                             THEN p_dados->>'rqe' ELSE rqe END,
    telefone_alternativo = CASE WHEN p_dados ? 'telefone_alternativo'
                             THEN p_dados->>'telefone_alternativo' ELSE telefone_alternativo END,
    atende_criancas      = CASE WHEN p_dados ? 'atende_criancas'
                             THEN (p_dados->>'atende_criancas')::boolean ELSE atende_criancas END,
    atende_adultos       = CASE WHEN p_dados ? 'atende_adultos'
                             THEN (p_dados->>'atende_adultos')::boolean ELSE atende_adultos END,
    convenios_restricoes = CASE WHEN p_dados ? 'convenios_restricoes'
                             THEN p_dados->'convenios_restricoes' ELSE convenios_restricoes END,
    horarios             = CASE WHEN p_dados ? 'horarios'
                             THEN p_dados->'horarios' ELSE horarios END,
    updated_at           = now()
  WHERE id = p_medico_id;

  -- Sincronizar vínculos via pivot
  IF p_atendimentos_ids IS NOT NULL THEN
    IF array_length(p_atendimentos_ids, 1) > 0 THEN
      -- Desativar vínculos que saíram da lista
      DELETE FROM public.medico_atendimento
      WHERE medico_id   = p_medico_id
        AND cliente_id  = v_cliente_id
        AND atendimento_id <> ALL(p_atendimentos_ids);

      -- Inserir/reativar vínculos da lista (valor_override preservado no ON CONFLICT)
      INSERT INTO public.medico_atendimento (medico_id, atendimento_id, cliente_id, ativo)
      SELECT p_medico_id, a_id, v_cliente_id, true
      FROM unnest(p_atendimentos_ids) AS a_id
      -- Somente IDs que pertencem ao mesmo cliente (isolamento de tenant)
      WHERE EXISTS (
        SELECT 1 FROM public.atendimentos
        WHERE id = a_id AND cliente_id = v_cliente_id
      )
      ON CONFLICT (medico_id, atendimento_id) DO UPDATE
        SET ativo      = true,
            updated_at = now();

    ELSE
      -- Array vazio explícito: remover todos os vínculos do médico
      DELETE FROM public.medico_atendimento
      WHERE medico_id  = p_medico_id
        AND cliente_id = v_cliente_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'medico_id', p_medico_id,
    'message', 'Médico atualizado com sucesso'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.atualizar_medico(UUID, JSONB, UUID[])
  TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════
-- 5. Atualizar get_medicos_por_clinica para retornar atendimentos via pivot
--    Adiciona campo atendimentos_ids (array de UUIDs dos serviços vinculados)
-- ═══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_medicos_por_clinica(uuid);

CREATE OR REPLACE FUNCTION public.get_medicos_por_clinica(p_cliente_id UUID)
RETURNS TABLE (
  id                   UUID,
  nome                 VARCHAR,
  especialidade        VARCHAR,
  ativo                BOOLEAN,
  convenios_aceitos    TEXT[],
  convenios_restricoes JSONB,
  idade_minima         INTEGER,
  idade_maxima         INTEGER,
  observacoes          TEXT,
  horarios             JSONB,
  crm                  VARCHAR,
  rqe                  VARCHAR,
  telefone_alternativo VARCHAR,
  atende_criancas      BOOLEAN,
  atende_adultos       BOOLEAN,
  created_at           TIMESTAMP WITHOUT TIME ZONE,
  atendimentos_ids     UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.nome,
    m.especialidade,
    m.ativo,
    m.convenios_aceitos,
    m.convenios_restricoes,
    m.idade_minima,
    m.idade_maxima,
    m.observacoes,
    m.horarios,
    m.crm,
    m.rqe,
    m.telefone_alternativo::VARCHAR,
    COALESCE(m.atende_criancas, true),
    COALESCE(m.atende_adultos, true),
    m.created_at,
    -- Atendimentos vinculados via pivot (substitui filtro por medico_id)
    COALESCE(
      ARRAY(
        SELECT ma.atendimento_id
        FROM public.medico_atendimento ma
        WHERE ma.medico_id  = m.id
          AND ma.cliente_id = p_cliente_id
          AND ma.ativo      = true
        ORDER BY ma.atendimento_id
      ),
      ARRAY[]::UUID[]
    ) AS atendimentos_ids
  FROM public.medicos m
  WHERE m.cliente_id = p_cliente_id
  ORDER BY m.nome;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_medicos_por_clinica(UUID)
  TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════
-- 6. Adicionar validação do par (medico_id, atendimento_id) em
--    criar_agendamento_atomico e criar_agendamento_atomico_externo.
--
--    Estratégia compatível com retroatividade: só valida se o médico
--    já tiver entradas na pivot (evita regressão em dados parcialmente migrados).
-- ═══════════════════════════════════════════════════════════════

-- Criar função auxiliar reutilizada pelas duas RPCs
CREATE OR REPLACE FUNCTION public.validar_par_medico_atendimento(
  p_medico_id      UUID,
  p_atendimento_id UUID,
  p_cliente_id     UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    CASE
      -- Se o médico ainda não tem entradas na pivot: permitir (compatibilidade)
      WHEN NOT EXISTS (
        SELECT 1 FROM public.medico_atendimento
        WHERE medico_id = p_medico_id AND cliente_id = p_cliente_id
      ) THEN true
      -- Caso contrário: exigir que o par exista e esteja ativo
      ELSE EXISTS (
        SELECT 1 FROM public.medico_atendimento
        WHERE medico_id      = p_medico_id
          AND atendimento_id = p_atendimento_id
          AND cliente_id     = p_cliente_id
          AND ativo          = true
      )
    END;
$$;

GRANT EXECUTE ON FUNCTION public.validar_par_medico_atendimento(UUID, UUID, UUID)
  TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════
-- 7. criar_agendamento_atomico — adiciona validação do par via pivot
--    (bloco 2b inserido após a validação do médico, antes dos bloqueios)
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

  -- 2b. Validar par (medico, atendimento) via pivot M:N
  --     Só valida se o médico já tiver entradas na pivot (compatível com dados legados)
  IF NOT validar_par_medico_atendimento(p_medico_id, p_atendimento_id, v_cliente_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Este tipo de atendimento não está vinculado a este médico'
    );
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

GRANT EXECUTE ON FUNCTION public.criar_agendamento_atomico(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, UUID, BOOLEAN)
  TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════
-- 8. criar_agendamento_atomico_externo — adiciona validação do par via pivot
-- ═══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.criar_agendamento_atomico_externo(
  uuid, text, date, text, text, text, uuid, uuid, date, time without time zone, text, text, boolean, text
);

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
  p_criado_por         TEXT    DEFAULT 'api_externa',
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
  SELECT COUNT(*)
  INTO v_blocked_check
  FROM public.bloqueios_agenda
  WHERE medico_id    = p_medico_id
    AND cliente_id   = p_cliente_id
    AND status       = 'ativo'
    AND p_data_agendamento BETWEEN data_inicio AND data_fim;

  IF v_blocked_check > 0 THEN
    RAISE EXCEPTION 'A agenda está bloqueada nesta data';
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
  TO anon, authenticated, service_role;
