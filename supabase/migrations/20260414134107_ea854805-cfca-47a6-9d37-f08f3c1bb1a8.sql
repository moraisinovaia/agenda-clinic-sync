
DO $$
DECLARE
  v_medico_id uuid := 'ddf2d7e6-2c0f-4ef3-b3c7-f867078917cf';
  v_br_id uuid := 'd0f76351-1b94-4507-86c9-592d1433d305';
  v_config jsonb;
  v_new_convenios jsonb;
  v_servicos jsonb;
  v_key text;
  v_srv jsonb;
  v_periodo text;
  v_per jsonb;
BEGIN
  -- 1) Update medicos.convenios_aceitos: remove MEDPREV
  UPDATE medicos
  SET convenios_aceitos = ARRAY[
    'CAMED','CASSI','CPP','GEAP','MEDCLIN','MEDSAUDE',
    'MINERAÇÃO CARAIBA','PARTICULAR','SAUDE CAIXA'
  ]
  WHERE id = v_medico_id;

  -- 2) Update business_rules.config
  SELECT config INTO v_config FROM business_rules WHERE id = v_br_id;

  v_new_convenios := '["CAMED","CASSI","CPP","GEAP","MEDCLIN","MEDSAUDE","MINERAÇÃO CARAIBA","PARTICULAR","SAUDE CAIXA"]'::jsonb;

  -- Update convenios lists
  v_config := jsonb_set(v_config, '{convenios,aceitos}', v_new_convenios);
  v_config := jsonb_set(v_config, '{convenios_aceitos}', v_new_convenios);

  -- Update limite_por_turno to 10
  v_config := jsonb_set(v_config, '{limite_por_turno}', '10'::jsonb);

  -- Update period limits to 10
  FOR v_periodo IN SELECT * FROM jsonb_object_keys(v_config->'periodos')
  LOOP
    v_per := v_config->'periodos'->v_periodo;
    IF (v_per->>'ativo')::boolean THEN
      v_config := jsonb_set(v_config, ARRAY['periodos', v_periodo, 'limite_pacientes'], '10'::jsonb);
    END IF;
  END LOOP;

  -- Update service period limits to 10
  v_servicos := v_config->'servicos';
  FOR v_key IN SELECT * FROM jsonb_object_keys(v_servicos)
  LOOP
    v_srv := v_servicos->v_key;
    IF v_srv ? 'periodos' THEN
      FOR v_periodo IN SELECT * FROM jsonb_object_keys(v_srv->'periodos')
      LOOP
        v_per := v_srv->'periodos'->v_periodo;
        IF (v_per->>'ativo')::boolean THEN
          v_config := jsonb_set(v_config, ARRAY['servicos', v_key, 'periodos', v_periodo, 'limite'], '10'::jsonb);
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  UPDATE business_rules
  SET config = v_config, updated_at = now()
  WHERE id = v_br_id;
END $$;
