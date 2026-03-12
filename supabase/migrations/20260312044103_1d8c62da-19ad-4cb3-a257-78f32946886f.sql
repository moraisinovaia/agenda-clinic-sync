
-- Adicionar UNIMED VSF ao business_rules config do Dr. Guilherme
UPDATE business_rules
SET config = jsonb_set(
  jsonb_set(
    config,
    '{convenios}',
    (config->'convenios') || '"UNIMED VSF"'::jsonb
  ),
  '{convenios_aceitos}',
  (config->'convenios_aceitos') || '"UNIMED VSF"'::jsonb
),
updated_at = now()
WHERE id = 'b255fe45-82a2-48eb-b0f1-46bb2700c7d1';
