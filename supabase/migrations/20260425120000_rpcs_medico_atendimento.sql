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
