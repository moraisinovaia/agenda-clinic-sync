-- De-duplicação de atendimentos criados pelo modelo 1:1 anterior.
--
-- O modelo antigo duplicava o mesmo serviço por médico (ex: "Consulta Cardiológica"
-- existia como 4 registros distintos, 1 por médico). Agora que a pivot existe,
-- mantemos 1 registro canônico por (cliente_id, nome, tipo) e redirecionamos
-- todas as FKs dependentes para ele.
--
-- Canônico = registro mais antigo (created_at ASC) do grupo.
-- Dependências: agendamentos.atendimento_id, fila_espera.atendimento_id,
--               medico_atendimento.atendimento_id.

DO $$
DECLARE
  v_agendamentos_atualizados INTEGER := 0;
  v_fila_espera_atualizados  INTEGER := 0;
  v_pivot_removidas          INTEGER := 0;
  v_pivot_atualizadas        INTEGER := 0;
  v_atendimentos_deletados   INTEGER := 0;
BEGIN

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
  -- Se medico_id X já tem entrada para canonical_id, a entrada para dup_id é removida.
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
      updated_at     = now()
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
