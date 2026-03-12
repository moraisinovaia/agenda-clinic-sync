
-- Corrigir duplicação de UNIMED VSF no business_rules
UPDATE business_rules
SET config = jsonb_set(
  jsonb_set(
    config,
    '{convenios}',
    (SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements(config->'convenios') AS value)
  ),
  '{convenios_aceitos}',
  (SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements(config->'convenios_aceitos') AS value)
),
updated_at = now()
WHERE id = 'b255fe45-82a2-48eb-b0f1-46bb2700c7d1';
