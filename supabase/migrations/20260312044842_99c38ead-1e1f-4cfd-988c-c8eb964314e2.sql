
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
WHERE id = '24b1c962-e132-4691-b1db-8410dd180001';
