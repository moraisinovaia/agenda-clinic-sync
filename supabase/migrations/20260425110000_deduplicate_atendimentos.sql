-- De-duplicação de atendimentos criados pelo modelo 1:1 anterior.
--
-- O modelo antigo duplicava o mesmo serviço por médico (ex: "Consulta Cardiológica"
-- existia como 4 registros distintos, 1 por médico). Agora que a pivot existe,
-- mantemos 1 registro canônico por (cliente_id, nome, tipo) e redirecionamos
-- todas as FKs dependentes para ele.
--
-- Canônico = registro mais antigo (created_at ASC) do grupo.
-- Merge seguro: antes de deletar, o canônico recebe os melhores valores de cada
--   campo (não-nulo + mais recentemente atualizado) de todos os membros do grupo.
-- Dependências redirecionadas: agendamentos.atendimento_id, fila_espera.atendimento_id,
--               medico_atendimento.atendimento_id.

DO $$
DECLARE
  v_agendamentos_atualizados INTEGER := 0;
  v_fila_espera_atualizados  INTEGER := 0;
  v_pivot_removidas          INTEGER := 0;
  v_pivot_atualizadas        INTEGER := 0;
  v_atendimentos_deletados   INTEGER := 0;
  v_grupos_total             INTEGER := 0;
  v_grupos_com_dup           INTEGER := 0;
BEGIN

  -- ─── Relatório prévio ────────────────────────────────────────────────────────
  SELECT COUNT(DISTINCT (cliente_id, lower(trim(nome)), tipo))
  INTO v_grupos_total
  FROM public.atendimentos;

  SELECT COUNT(*) INTO v_grupos_com_dup
  FROM (
    SELECT cliente_id, lower(trim(nome)) AS nome_norm, tipo
    FROM public.atendimentos
    GROUP BY cliente_id, lower(trim(nome)), tipo
    HAVING COUNT(*) > 1
  ) t;

  RAISE NOTICE '═══ De-duplicação: % grupos totais, % com duplicatas ═══',
    v_grupos_total, v_grupos_com_dup;

  -- Listar grupos com divergências nos campos monetários/textuais para inspeção
  RAISE NOTICE '─── Grupos com valores divergentes (serão mesclados) ───';
  FOR v_grupos_total IN
    SELECT 1 FROM (
      SELECT
        cliente_id,
        lower(trim(nome)) AS nome_norm,
        tipo,
        COUNT(*) AS qtd,
        COUNT(DISTINCT COALESCE(valor_particular::text, 'NULL')) AS v_val,
        COUNT(DISTINCT COALESCE(codigo, 'NULL')) AS v_cod
      FROM public.atendimentos
      GROUP BY cliente_id, lower(trim(nome)), tipo
      HAVING COUNT(*) > 1
        AND (
          COUNT(DISTINCT COALESCE(valor_particular::text, 'NULL')) > 1
          OR COUNT(DISTINCT COALESCE(codigo, 'NULL')) > 1
        )
    ) t
  LOOP
    NULL; -- Só para contar; o RAISE NOTICE detalhado está abaixo
  END LOOP;

  -- ─── Passo 0: Mesclar dados dos duplicatas no canônico (ANTES de deletar) ───
  -- Para cada campo, pega o valor não-nulo mais recentemente atualizado do grupo.
  WITH canonicos AS (
    SELECT DISTINCT ON (cliente_id, lower(trim(nome)), tipo)
      id            AS canonical_id,
      cliente_id,
      lower(trim(nome)) AS nome_norm,
      tipo
    FROM public.atendimentos
    ORDER BY cliente_id, lower(trim(nome)), tipo, created_at ASC
  ),
  -- Todos os membros do grupo (inclusive o canônico)
  todos AS (
    SELECT
      a.id,
      a.cliente_id,
      lower(trim(a.nome)) AS nome_norm,
      a.tipo,
      c.canonical_id,
      a.codigo,
      a.valor_particular,
      a.valor_particular_avista,
      a.valor_monocular,
      a.valor_monocular_avista,
      a.coparticipacao_unimed_20,
      a.coparticipacao_unimed_40,
      a.forma_pagamento,
      a.observacoes,
      a.restricoes,
      a.horarios,
      a.ativo,
      COALESCE(a.updated_at, a.created_at) AS ts
    FROM public.atendimentos a
    JOIN canonicos c
      ON  c.cliente_id = a.cliente_id
      AND c.nome_norm  = lower(trim(a.nome))
      AND c.tipo       = a.tipo
  ),
  -- Para cada campo, coleta o melhor valor (não-nulo + mais recente) de todos os membros
  melhores AS (
    SELECT
      canonical_id,
      (array_agg(codigo                ORDER BY ts DESC NULLS LAST) FILTER (WHERE codigo                IS NOT NULL AND codigo                != ''))[1] AS melhor_codigo,
      (array_agg(valor_particular      ORDER BY ts DESC NULLS LAST) FILTER (WHERE valor_particular      IS NOT NULL))[1] AS melhor_valor_particular,
      (array_agg(valor_particular_avista ORDER BY ts DESC NULLS LAST) FILTER (WHERE valor_particular_avista IS NOT NULL))[1] AS melhor_valor_particular_avista,
      (array_agg(valor_monocular       ORDER BY ts DESC NULLS LAST) FILTER (WHERE valor_monocular       IS NOT NULL))[1] AS melhor_valor_monocular,
      (array_agg(valor_monocular_avista ORDER BY ts DESC NULLS LAST) FILTER (WHERE valor_monocular_avista IS NOT NULL))[1] AS melhor_valor_monocular_avista,
      (array_agg(coparticipacao_unimed_20 ORDER BY ts DESC NULLS LAST) FILTER (WHERE coparticipacao_unimed_20 IS NOT NULL))[1] AS melhor_copart_20,
      (array_agg(coparticipacao_unimed_40 ORDER BY ts DESC NULLS LAST) FILTER (WHERE coparticipacao_unimed_40 IS NOT NULL))[1] AS melhor_copart_40,
      (array_agg(forma_pagamento       ORDER BY ts DESC NULLS LAST) FILTER (WHERE forma_pagamento       IS NOT NULL AND forma_pagamento       != ''))[1] AS melhor_forma_pagamento,
      (array_agg(observacoes           ORDER BY ts DESC NULLS LAST) FILTER (WHERE observacoes           IS NOT NULL AND observacoes           != ''))[1] AS melhor_observacoes,
      (array_agg(restricoes            ORDER BY ts DESC NULLS LAST) FILTER (WHERE restricoes            IS NOT NULL AND restricoes            != ''))[1] AS melhor_restricoes,
      (array_agg(horarios              ORDER BY ts DESC NULLS LAST) FILTER (WHERE horarios              IS NOT NULL))[1] AS melhor_horarios,
      bool_or(ativo) AS melhor_ativo
    FROM todos
    GROUP BY canonical_id
  )
  UPDATE public.atendimentos a
  SET
    codigo                   = COALESCE(m.melhor_codigo,                    a.codigo),
    valor_particular         = COALESCE(m.melhor_valor_particular,          a.valor_particular),
    valor_particular_avista  = COALESCE(m.melhor_valor_particular_avista,   a.valor_particular_avista),
    valor_monocular          = COALESCE(m.melhor_valor_monocular,           a.valor_monocular),
    valor_monocular_avista   = COALESCE(m.melhor_valor_monocular_avista,    a.valor_monocular_avista),
    coparticipacao_unimed_20 = COALESCE(m.melhor_copart_20,                 a.coparticipacao_unimed_20),
    coparticipacao_unimed_40 = COALESCE(m.melhor_copart_40,                 a.coparticipacao_unimed_40),
    forma_pagamento          = COALESCE(m.melhor_forma_pagamento,            a.forma_pagamento),
    observacoes              = COALESCE(m.melhor_observacoes,                a.observacoes),
    restricoes               = COALESCE(m.melhor_restricoes,                 a.restricoes),
    horarios                 = COALESCE(m.melhor_horarios,                   a.horarios),
    ativo                    = m.melhor_ativo,
    updated_at               = now()
  FROM melhores m
  WHERE a.id = m.canonical_id;

  RAISE NOTICE 'Passo 0 concluído: canônicos atualizados com melhores valores do grupo.';

  -- ─── Passo 1: Redirecionar agendamentos ──────────────────────────────────
  WITH canonicos AS (
    SELECT DISTINCT ON (cliente_id, lower(trim(nome)), tipo)
      id AS canonical_id,
      cliente_id,
      lower(trim(nome)) AS nome_norm,
      tipo
    FROM public.atendimentos
    ORDER BY cliente_id, lower(trim(nome)), tipo, created_at ASC
  ),
  duplicatas AS (
    SELECT a.id AS dup_id, c.canonical_id
    FROM public.atendimentos a
    JOIN canonicos c
      ON  c.cliente_id = a.cliente_id
      AND c.nome_norm  = lower(trim(a.nome))
      AND c.tipo       = a.tipo
      AND c.canonical_id <> a.id
  )
  UPDATE public.agendamentos ag
  SET atendimento_id = d.canonical_id
  FROM duplicatas d
  WHERE ag.atendimento_id = d.dup_id;

  GET DIAGNOSTICS v_agendamentos_atualizados = ROW_COUNT;

  -- ─── Passo 2: Redirecionar fila_espera ───────────────────────────────────
  WITH canonicos AS (
    SELECT DISTINCT ON (cliente_id, lower(trim(nome)), tipo)
      id AS canonical_id,
      cliente_id,
      lower(trim(nome)) AS nome_norm,
      tipo
    FROM public.atendimentos
    ORDER BY cliente_id, lower(trim(nome)), tipo, created_at ASC
  ),
  duplicatas AS (
    SELECT a.id AS dup_id, c.canonical_id
    FROM public.atendimentos a
    JOIN canonicos c
      ON  c.cliente_id = a.cliente_id
      AND c.nome_norm  = lower(trim(a.nome))
      AND c.tipo       = a.tipo
      AND c.canonical_id <> a.id
  )
  UPDATE public.fila_espera fe
  SET atendimento_id = d.canonical_id
  FROM duplicatas d
  WHERE fe.atendimento_id = d.dup_id;

  GET DIAGNOSTICS v_fila_espera_atualizados = ROW_COUNT;

  -- ─── Passo 3: Limpar pivot para entradas que conflitariam ao redirecionar ─
  WITH canonicos AS (
    SELECT DISTINCT ON (cliente_id, lower(trim(nome)), tipo)
      id AS canonical_id,
      cliente_id,
      lower(trim(nome)) AS nome_norm,
      tipo
    FROM public.atendimentos
    ORDER BY cliente_id, lower(trim(nome)), tipo, created_at ASC
  ),
  duplicatas AS (
    SELECT a.id AS dup_id, c.canonical_id
    FROM public.atendimentos a
    JOIN canonicos c
      ON  c.cliente_id = a.cliente_id
      AND c.nome_norm  = lower(trim(a.nome))
      AND c.tipo       = a.tipo
      AND c.canonical_id <> a.id
  )
  DELETE FROM public.medico_atendimento ma
  USING duplicatas d
  WHERE ma.atendimento_id = d.dup_id
    AND EXISTS (
      SELECT 1 FROM public.medico_atendimento ma2
      WHERE ma2.medico_id      = ma.medico_id
        AND ma2.atendimento_id = d.canonical_id
    );

  GET DIAGNOSTICS v_pivot_removidas = ROW_COUNT;

  -- ─── Passo 4: Redirecionar entradas remanescentes da pivot ───────────────
  -- Preserva valor_override do duplicata se o canônico não tiver override
  WITH canonicos AS (
    SELECT DISTINCT ON (cliente_id, lower(trim(nome)), tipo)
      id AS canonical_id,
      cliente_id,
      lower(trim(nome)) AS nome_norm,
      tipo
    FROM public.atendimentos
    ORDER BY cliente_id, lower(trim(nome)), tipo, created_at ASC
  ),
  duplicatas AS (
    SELECT a.id AS dup_id, c.canonical_id
    FROM public.atendimentos a
    JOIN canonicos c
      ON  c.cliente_id = a.cliente_id
      AND c.nome_norm  = lower(trim(a.nome))
      AND c.tipo       = a.tipo
      AND c.canonical_id <> a.id
  )
  UPDATE public.medico_atendimento ma
  SET atendimento_id = d.canonical_id,
      -- Preservar valor_override do duplicata se o canônico ainda não tiver
      valor_override = COALESCE(
        (SELECT ma2.valor_override FROM public.medico_atendimento ma2
         WHERE ma2.medico_id = ma.medico_id AND ma2.atendimento_id = d.canonical_id
         LIMIT 1),
        ma.valor_override
      ),
      updated_at = now()
  FROM duplicatas d
  WHERE ma.atendimento_id = d.dup_id;

  GET DIAGNOSTICS v_pivot_atualizadas = ROW_COUNT;

  -- ─── Passo 5: Deletar registros duplicados de atendimentos ───────────────
  WITH canonicos AS (
    SELECT DISTINCT ON (cliente_id, lower(trim(nome)), tipo)
      id AS canonical_id,
      cliente_id,
      lower(trim(nome)) AS nome_norm,
      tipo
    FROM public.atendimentos
    ORDER BY cliente_id, lower(trim(nome)), tipo, created_at ASC
  )
  DELETE FROM public.atendimentos a
  WHERE EXISTS (
    SELECT 1 FROM canonicos c
    WHERE  c.cliente_id  = a.cliente_id
      AND  c.nome_norm   = lower(trim(a.nome))
      AND  c.tipo        = a.tipo
      AND  c.canonical_id <> a.id
  );

  GET DIAGNOSTICS v_atendimentos_deletados = ROW_COUNT;

  RAISE NOTICE
    'De-duplicação concluída: % agendamentos, % fila_espera, % pivot removidas, % pivot redirecionadas, % atendimentos deletados',
    v_agendamentos_atualizados,
    v_fila_espera_atualizados,
    v_pivot_removidas,
    v_pivot_atualizadas,
    v_atendimentos_deletados;

END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Deprecar medico_id em atendimentos
-- Remove a FK (não mais gerenciada aqui) e marca a coluna como obsoleta.
-- A coluna em si será removida em migration futura, após validação.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.atendimentos
  DROP CONSTRAINT IF EXISTS atendimentos_medico_id_fkey;

COMMENT ON COLUMN public.atendimentos.medico_id IS
  'DEPRECATED — use tabela medico_atendimento. Coluna mantida para rollback; será removida após validação.';
