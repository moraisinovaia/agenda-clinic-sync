-- ENDOGASTRO
-- Fix 1: MEDSAUDE nos 4 cardiologistas e Joana
-- Fix 2: MED CENTER na Joana
-- Fix 3: MED PREV → MEDPREV no Dr. Heverson (medicos + business_rules)
-- Fix 4: vincular MAPA (DR DIEGO) a Joana
-- Fix 5: vincular Holter (DR ARISTÓFILO) a Joana

DO $$
DECLARE
  v_cliente_id uuid := '39e120b4-5fb7-4d6f-9f91-a598a5bbd253';
  v_joana_id   uuid := 'ff7cd440-0284-4d47-a721-4c0d4d6d2867';
  v_atend_id   uuid;

  v_aristofilo uuid := 'e4298fe4-1d73-4099-83e0-8581cabb7e96';
  v_diego      uuid := '04505052-89c5-4090-9921-806a6fc7b544';
  v_heverson   uuid := 'fdb7862c-e83d-4294-a36c-a61f177c9487';
  v_max        uuid := '84f434dc-21f6-41a9-962e-9b0722a0e2d4';
BEGIN

  -- ── Fix 1: MEDSAUDE em medicos.convenios_aceitos (4 cardiologistas + Joana) ──
  UPDATE public.medicos
     SET convenios_aceitos = array_append(convenios_aceitos, 'MEDSAUDE'),
         updated_at = now()
   WHERE id IN (v_aristofilo, v_diego, v_heverson, v_max, v_joana_id)
     AND NOT ('MEDSAUDE' = ANY(convenios_aceitos));

  -- ── Fix 2: MED CENTER em Joana ──
  UPDATE public.medicos
     SET convenios_aceitos = array_append(convenios_aceitos, 'MED CENTER'),
         updated_at = now()
   WHERE id = v_joana_id
     AND NOT ('MED CENTER' = ANY(convenios_aceitos));

  -- ── Fix 3a: corrigir "MED PREV" → "MEDPREV" em Dr. Heverson (medicos) ──
  UPDATE public.medicos
     SET convenios_aceitos = array_replace(convenios_aceitos, 'MED PREV', 'MEDPREV'),
         updated_at = now()
   WHERE id = v_heverson
     AND 'MED PREV' = ANY(convenios_aceitos);

  -- ── Fix 4: MEDSAUDE nos business_rules dos cardiologistas ──
  UPDATE public.business_rules
     SET config = jsonb_set(
           config,
           '{convenios_aceitos}',
           (config->'convenios_aceitos') || '"MEDSAUDE"'
         ),
         updated_at = now()
   WHERE cliente_id = v_cliente_id
     AND medico_id IN (v_aristofilo, v_diego, v_heverson, v_max)
     AND ativo = true
     AND config ? 'convenios_aceitos'
     AND NOT (config->'convenios_aceitos' @> '"MEDSAUDE"');

  -- ── Fix 3b: corrigir "MED PREV" → "MEDPREV" no business_rules de Heverson ──
  UPDATE public.business_rules
     SET config = jsonb_set(
           config,
           '{convenios_aceitos}',
           (SELECT jsonb_agg(
             CASE WHEN elem::text = '"MED PREV"' THEN '"MEDPREV"'::jsonb ELSE elem END
           )
           FROM jsonb_array_elements(config->'convenios_aceitos') AS elem)
         ),
         updated_at = now()
   WHERE medico_id = v_heverson
     AND cliente_id = v_cliente_id
     AND ativo = true
     AND config->'convenios_aceitos' @> '"MED PREV"';

  -- ── Fix 5: vincular MAPA (DR DIEGO) a Joana ──
  SELECT id INTO v_atend_id
    FROM public.atendimentos
   WHERE cliente_id = v_cliente_id AND nome = 'MAPA (DR DIEGO)' LIMIT 1;

  IF v_atend_id IS NOT NULL THEN
    UPDATE public.atendimentos
       SET medico_id = v_joana_id, medico_nome = 'JOANA'
     WHERE id = v_atend_id AND medico_id IS NULL;

    INSERT INTO public.medico_atendimento (medico_id, atendimento_id, cliente_id, ativo)
    VALUES (v_joana_id, v_atend_id, v_cliente_id, true)
    ON CONFLICT (medico_id, atendimento_id) DO NOTHING;
  END IF;

  -- ── Fix 6: vincular Holter (DR ARISTÓFILO) a Joana ──
  SELECT id INTO v_atend_id
    FROM public.atendimentos
   WHERE cliente_id = v_cliente_id AND nome = 'Holter (DR ARISTÓFILO)' LIMIT 1;

  IF v_atend_id IS NOT NULL THEN
    UPDATE public.atendimentos
       SET medico_id = v_joana_id, medico_nome = 'JOANA'
     WHERE id = v_atend_id AND medico_id IS NULL;

    INSERT INTO public.medico_atendimento (medico_id, atendimento_id, cliente_id, ativo)
    VALUES (v_joana_id, v_atend_id, v_cliente_id, true)
    ON CONFLICT (medico_id, atendimento_id) DO NOTHING;
  END IF;

  RAISE NOTICE 'OK: ENDOGASTRO fixes aplicados';
END $$;
