-- [H4] Cleanup de pacientes duplicados sem data_nascimento + unique index
-- covering NULL via COALESCE com '1900-01-01'.
--
-- Antes: idx_pacientes_unique_por_cliente tinha WHERE data_nascimento IS NOT NULL.
-- Em produção apareceram 41 nomes duplicados (47 rows excedentes) só no 1º cliente,
-- causados por race em fila-espera quando paciente do WhatsApp não tinha data.
-- (Conteúdo aplicado via MCP em 2026-05-01; este arquivo é a versão versionada.)

BEGIN;

ALTER TABLE agendamentos DISABLE TRIGGER validate_insurance_trigger;

CREATE TEMP TABLE _paciente_dedup AS
WITH grupos AS (
  SELECT cliente_id, lower(trim(nome_completo)) AS nome_norm, id, created_at,
         row_number() OVER (PARTITION BY cliente_id, lower(trim(nome_completo)) ORDER BY created_at, id) AS rn
  FROM pacientes WHERE data_nascimento IS NULL
)
SELECT cliente_id, nome_norm, id,
       (SELECT g2.id FROM grupos g2 WHERE g2.cliente_id = g.cliente_id AND g2.nome_norm = g.nome_norm AND g2.rn = 1) AS canonico_id, rn
FROM grupos g
WHERE EXISTS (SELECT 1 FROM grupos g3 WHERE g3.cliente_id = g.cliente_id AND g3.nome_norm = g.nome_norm AND g3.rn > 1);

UPDATE agendamentos a
SET paciente_id = d.canonico_id,
    observacoes = COALESCE(observacoes, '') || format(' [merged paciente %s→%s]', d.id, d.canonico_id)
FROM _paciente_dedup d WHERE a.paciente_id = d.id AND d.rn > 1;

UPDATE fila_espera f SET paciente_id = d.canonico_id
FROM _paciente_dedup d WHERE f.paciente_id = d.id AND d.rn > 1;

DELETE FROM pacientes p USING _paciente_dedup d WHERE p.id = d.id AND d.rn > 1;

ALTER TABLE agendamentos ENABLE TRIGGER validate_insurance_trigger;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pacientes_unique_por_cliente_v2
  ON public.pacientes (cliente_id, lower(trim(nome_completo)), COALESCE(data_nascimento, '1900-01-01'::date));

DROP TABLE _paciente_dedup;
COMMIT;
