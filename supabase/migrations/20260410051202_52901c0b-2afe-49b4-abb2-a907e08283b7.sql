
-- 1. Add MEDPREV to medicos.convenios_aceitos for Hermann, Manoel, Marina
UPDATE medicos SET convenios_aceitos = array_append(convenios_aceitos, 'MEDPREV'), updated_at = now()
WHERE id = '4ae504f1-0c32-415b-b1d8-3cadce30c253' AND NOT ('MEDPREV' = ANY(convenios_aceitos));

UPDATE medicos SET convenios_aceitos = array_append(convenios_aceitos, 'MEDPREV'), updated_at = now()
WHERE id = '9f126f6a-5b42-4a1c-ad34-9cc33cd2b0ee' AND NOT ('MEDPREV' = ANY(convenios_aceitos));

UPDATE medicos SET convenios_aceitos = array_append(convenios_aceitos, 'MEDPREV'), updated_at = now()
WHERE id = 'ddf2d7e6-2c0f-4ef3-b3c7-f867078917cf' AND NOT ('MEDPREV' = ANY(convenios_aceitos));

-- 2. Add MEDPREV to business_rules config->convenios_aceitos for Hermann
UPDATE business_rules 
SET config = jsonb_set(
  config,
  '{convenios_aceitos}',
  (config->'convenios_aceitos') || '"MEDPREV"'::jsonb
),
updated_at = now()
WHERE id = 'e18bb228-62fb-459a-b4f5-25c04737a64f'
AND NOT (config->'convenios_aceitos' @> '"MEDPREV"'::jsonb);

-- 3. Add MEDPREV to business_rules config->convenios_aceitos for Manoel
UPDATE business_rules 
SET config = jsonb_set(
  config,
  '{convenios_aceitos}',
  (config->'convenios_aceitos') || '"MEDPREV"'::jsonb
),
updated_at = now()
WHERE id = '7d1f90b9-05df-48d0-9f65-64c970c5a27a'
AND NOT (config->'convenios_aceitos' @> '"MEDPREV"'::jsonb);

-- 4. Add MEDPREV to business_rules config->convenios_aceitos for Marina
UPDATE business_rules 
SET config = jsonb_set(
  config,
  '{convenios_aceitos}',
  (config->'convenios_aceitos') || '"MEDPREV"'::jsonb
),
updated_at = now()
WHERE id = 'd0f76351-1b94-4507-86c9-592d1433d305'
AND NOT (config->'convenios_aceitos' @> '"MEDPREV"'::jsonb);

-- 5. Also update Marina's config->convenios->aceitos (she has a nested structure)
UPDATE business_rules 
SET config = jsonb_set(
  config,
  '{convenios,aceitos}',
  (config->'convenios'->'aceitos') || '"MEDPREV"'::jsonb
),
updated_at = now()
WHERE id = 'd0f76351-1b94-4507-86c9-592d1433d305'
AND config->'convenios'->'aceitos' IS NOT NULL
AND NOT (config->'convenios'->'aceitos' @> '"MEDPREV"'::jsonb);
