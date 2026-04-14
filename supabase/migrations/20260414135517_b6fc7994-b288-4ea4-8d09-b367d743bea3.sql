
DO $$
DECLARE
  v_rec RECORD;
  v_config jsonb;
  v_conv jsonb;
BEGIN
  -- Update medicos.convenios_aceitos: append 'DR VISÃO' where missing
  UPDATE medicos
  SET convenios_aceitos = array_append(convenios_aceitos, 'DR VISÃO')
  WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a'
    AND ativo = true
    AND NOT ('DR VISÃO' = ANY(convenios_aceitos));

  -- Update business_rules.config for each affected doctor
  FOR v_rec IN
    SELECT br.id, br.config
    FROM business_rules br
    JOIN medicos m ON m.id = br.medico_id
    WHERE m.cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a'
      AND m.ativo = true
      AND br.ativo = true
      AND br.id != 'b255fe45-82a2-48eb-b0f1-46bb2700c7d1' -- skip Guilherme (already has it)
  LOOP
    v_config := v_rec.config;

    -- Add to convenios array if exists
    IF v_config ? 'convenios' AND jsonb_typeof(v_config->'convenios') = 'array' THEN
      IF NOT v_config->'convenios' @> '"DR VISÃO"'::jsonb THEN
        v_config := jsonb_set(v_config, '{convenios}', (v_config->'convenios') || '"DR VISÃO"'::jsonb);
      END IF;
    END IF;

    -- Add to convenios_aceitos array if exists
    IF v_config ? 'convenios_aceitos' AND jsonb_typeof(v_config->'convenios_aceitos') = 'array' THEN
      IF NOT v_config->'convenios_aceitos' @> '"DR VISÃO"'::jsonb THEN
        v_config := jsonb_set(v_config, '{convenios_aceitos}', (v_config->'convenios_aceitos') || '"DR VISÃO"'::jsonb);
      END IF;
    END IF;

    -- Also handle nested convenios.aceitos
    IF v_config #> '{convenios,aceitos}' IS NOT NULL AND jsonb_typeof(v_config #> '{convenios,aceitos}') = 'array' THEN
      IF NOT (v_config #> '{convenios,aceitos}') @> '"DR VISÃO"'::jsonb THEN
        v_config := jsonb_set(v_config, '{convenios,aceitos}', (v_config #> '{convenios,aceitos}') || '"DR VISÃO"'::jsonb);
      END IF;
    END IF;

    UPDATE business_rules SET config = v_config, updated_at = now() WHERE id = v_rec.id;
  END LOOP;
END $$;
