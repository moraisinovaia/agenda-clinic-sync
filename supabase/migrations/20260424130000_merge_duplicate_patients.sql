-- Merge duplicate patients created by the NULL birth date + convenio-in-lookup bug.
--
-- Root cause (fixed in 20260424120000): criar_agendamento_atomico_externo was
-- creating a new patient record on every call when data_nascimento IS NULL,
-- because NULL = NULL is FALSE in SQL.
--
-- Strategy: for each duplicate group keep the oldest record (canonical),
-- reassign all agendamentos.paciente_id to the canonical, then delete excess records.
-- notificacoes_enviadas.paciente_id is SET NULL automatically on delete.
-- fila_espera has no affected rows in this dataset.

-- Disable insurance validation trigger for this data migration only.
-- The trigger checks convenio on agendamentos UPDATE; during dedup we're only
-- changing paciente_id (pointer consolidation), not the convenio itself.
ALTER TABLE public.agendamentos DISABLE TRIGGER USER;

DO $$
DECLARE
  v_pacientes_deletados INTEGER;
  v_agendamentos_reatribuidos INTEGER;
BEGIN
  -- Step 1: Reassign agendamentos from duplicate patients to canonical (oldest)
  WITH grupos AS (
    SELECT
      (array_agg(id ORDER BY created_at ASC))[1] AS canonical_id,
      array_agg(id ORDER BY created_at ASC) AS ordered_ids
    FROM public.pacientes
    GROUP BY cliente_id, lower(trim(nome_completo)), data_nascimento
    HAVING COUNT(*) > 1
  ),
  dup_pairs AS (
    SELECT
      canonical_id,
      unnest(ordered_ids[2:array_upper(ordered_ids, 1)]) AS dup_id
    FROM grupos
  )
  UPDATE public.agendamentos a
  SET paciente_id = dp.canonical_id
  FROM dup_pairs dp
  WHERE a.paciente_id = dp.dup_id;

  GET DIAGNOSTICS v_agendamentos_reatribuidos = ROW_COUNT;

  -- Step 2: Reassign fila_espera (none expected, but safe to run)
  WITH grupos AS (
    SELECT
      (array_agg(id ORDER BY created_at ASC))[1] AS canonical_id,
      array_agg(id ORDER BY created_at ASC) AS ordered_ids
    FROM public.pacientes
    GROUP BY cliente_id, lower(trim(nome_completo)), data_nascimento
    HAVING COUNT(*) > 1
  ),
  dup_pairs AS (
    SELECT
      canonical_id,
      unnest(ordered_ids[2:array_upper(ordered_ids, 1)]) AS dup_id
    FROM grupos
  )
  UPDATE public.fila_espera fe
  SET paciente_id = dp.canonical_id
  FROM dup_pairs dp
  WHERE fe.paciente_id = dp.dup_id;

  -- Step 3: Delete duplicate (non-canonical) patients
  -- notificacoes_enviadas.paciente_id SET NULL fires automatically via FK
  WITH grupos AS (
    SELECT
      array_agg(id ORDER BY created_at ASC) AS ordered_ids
    FROM public.pacientes
    GROUP BY cliente_id, lower(trim(nome_completo)), data_nascimento
    HAVING COUNT(*) > 1
  )
  DELETE FROM public.pacientes
  WHERE id IN (
    SELECT unnest(ordered_ids[2:array_upper(ordered_ids, 1)])
    FROM grupos
  );

  GET DIAGNOSTICS v_pacientes_deletados = ROW_COUNT;

  RAISE NOTICE 'Merge concluído: % agendamentos reatribuídos, % pacientes duplicados removidos',
    v_agendamentos_reatribuidos, v_pacientes_deletados;
END;
$$;

-- Re-enable triggers after data migration
ALTER TABLE public.agendamentos ENABLE TRIGGER USER;
