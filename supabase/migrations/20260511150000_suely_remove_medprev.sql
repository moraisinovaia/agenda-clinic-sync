-- Dra. Maria Suely Amorim Mendes (Oftalmologia) — remove MEDPREV do cadastro.
--
-- MEDPREV é convênio parceiro bloqueado globalmente no agente conversacional
-- (PARCEIROS_NORM em llm-agent-api/_handlers/chat.ts). Estava cadastrado por
-- engano nos convênios da Dra. Suely.
--
-- Locais (idempotente — só remove se existe):
--   1) medicos.convenios_aceitos (text[])
--   2) business_rules.config.convenios (jsonb array)
--   3) business_rules.config.convenios_aceitos (se existir)

DO $$
DECLARE
  v_medico_id  uuid := 'a38f801c-54fa-4676-b677-7593f05a527e';
  v_cliente_id uuid := '0b6a0a35-0059-4a0c-9fb8-413b6253c2ad';
BEGIN
  UPDATE public.medicos
  SET convenios_aceitos = array_remove(convenios_aceitos, 'MEDPREV')
  WHERE id = v_medico_id
    AND cliente_id = v_cliente_id
    AND 'MEDPREV' = ANY(convenios_aceitos);

  UPDATE public.business_rules
  SET config = jsonb_set(
    config,
    '{convenios}',
    (
      SELECT COALESCE(jsonb_agg(c), '[]'::jsonb)
      FROM jsonb_array_elements_text(config->'convenios') AS c
      WHERE c <> 'MEDPREV'
    )
  )
  WHERE medico_id = v_medico_id
    AND cliente_id = v_cliente_id
    AND (config->'convenios') @> '["MEDPREV"]'::jsonb;

  UPDATE public.business_rules
  SET config = jsonb_set(
    config,
    '{convenios_aceitos}',
    (
      SELECT COALESCE(jsonb_agg(c), '[]'::jsonb)
      FROM jsonb_array_elements_text(config->'convenios_aceitos') AS c
      WHERE c <> 'MEDPREV'
    )
  )
  WHERE medico_id = v_medico_id
    AND cliente_id = v_cliente_id
    AND (config->'convenios_aceitos') @> '["MEDPREV"]'::jsonb;
END $$;
