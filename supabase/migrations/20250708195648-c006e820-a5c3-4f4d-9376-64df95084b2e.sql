-- Remover médicos duplicados, mantendo apenas os registros mais antigos
WITH duplicates AS (
  SELECT 
    nome,
    MIN(created_at) as first_created,
    array_agg(id ORDER BY created_at) as ids
  FROM medicos 
  GROUP BY nome 
  HAVING COUNT(*) > 1
)
DELETE FROM medicos 
WHERE id IN (
  SELECT unnest(ids[2:]) 
  FROM duplicates
);