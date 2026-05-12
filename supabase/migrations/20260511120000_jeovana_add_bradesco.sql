-- Dra. Jeovana Brandão (ENDOGASTRO) — adicionar convênio BRADESCO.
--
-- Convênios ficam em 2 lugares paralelos:
--   1) medicos.convenios_aceitos (text[]) — usado por UI/listagens
--   2) business_rules.config.convenios + .convenios_aceitos (jsonb) — usado
--      pelo LLM/scheduling-api para validação
--
-- Migration idempotente: só adiciona se BRADESCO ainda não estiver presente.

DO $$
DECLARE
  v_medico_id uuid := 'e12528a9-5b88-426f-8ef9-d0213effd886';
  v_cliente_id uuid := '39e120b4-5fb7-4d6f-9f91-a598a5bbd253';
BEGIN
  -- 1) Tabela medicos
  UPDATE public.medicos
  SET convenios_aceitos = array_append(convenios_aceitos, 'BRADESCO')
  WHERE id = v_medico_id
    AND cliente_id = v_cliente_id
    AND NOT ('BRADESCO' = ANY(convenios_aceitos));

  -- 2) business_rules.config.convenios
  UPDATE public.business_rules
  SET config = jsonb_set(
    config,
    '{convenios}',
    (COALESCE(config->'convenios', '[]'::jsonb)) || '["BRADESCO"]'::jsonb
  )
  WHERE medico_id = v_medico_id
    AND cliente_id = v_cliente_id
    AND NOT (config->'convenios' @> '["BRADESCO"]'::jsonb);

  -- 3) business_rules.config.convenios_aceitos
  UPDATE public.business_rules
  SET config = jsonb_set(
    config,
    '{convenios_aceitos}',
    (COALESCE(config->'convenios_aceitos', '[]'::jsonb)) || '["BRADESCO"]'::jsonb
  )
  WHERE medico_id = v_medico_id
    AND cliente_id = v_cliente_id
    AND NOT (config->'convenios_aceitos' @> '["BRADESCO"]'::jsonb);
END $$;
