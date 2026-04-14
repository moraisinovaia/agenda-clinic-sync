
-- Get Dra. Camila's medico_id
DO $$
DECLARE
  v_medico_id uuid;
  v_br_id uuid;
  v_config jsonb;
  v_convenios_arr text[];
  v_new_convenios jsonb;
BEGIN
  -- Find Dra. Camila
  SELECT id INTO v_medico_id
  FROM medicos
  WHERE cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a'
    AND nome ILIKE '%camila%'
  LIMIT 1;

  IF v_medico_id IS NULL THEN
    RAISE EXCEPTION 'Dra. Camila not found';
  END IF;

  -- Update medicos.convenios_aceitos: remove HGU SAUDE and SUS CASA NOVA
  UPDATE medicos
  SET convenios_aceitos = ARRAY[
    'CAMED', 'CASSI', 'CPP', 'GEAP', 'MEDCLIN', 'MEDSAUDE', 'MEDPREV',
    'MINERAÇÃO CARAIBA', 'PARTICULAR', 'SAUDE CAIXA',
    'UNIMED 20%', 'UNIMED 40%', 'UNIMED INTERCAMBIO',
    'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED VSF'
  ],
  observacoes = 'Possui RQE. Especialidade em córnea, lentes de contato e refrativa. NÃO ATENDE HGU, NEM ENCAIXE DE URGÊNCIA.'
  WHERE id = v_medico_id;

  -- Update business_rules.config
  SELECT id, config INTO v_br_id, v_config
  FROM business_rules
  WHERE medico_id = v_medico_id
  LIMIT 1;

  IF v_br_id IS NOT NULL THEN
    -- Build new convenios array
    v_new_convenios := '["CAMED","CASSI","CPP","GEAP","MEDCLIN","MEDSAUDE","MEDPREV","MINERAÇÃO CARAIBA","PARTICULAR","SAUDE CAIXA","UNIMED 20%","UNIMED 40%","UNIMED INTERCAMBIO","UNIMED NACIONAL","UNIMED REGIONAL","UNIMED VSF"]'::jsonb;

    -- Update config
    v_config := jsonb_set(v_config, '{convenios}', v_new_convenios);
    v_config := jsonb_set(v_config, '{convenios_aceitos}', v_new_convenios);
    v_config := jsonb_set(v_config, '{observacoes}', '"Possui RQE. Especialidade em córnea, lentes de contato e refrativa. NÃO ATENDE HGU, NEM ENCAIXE DE URGÊNCIA."'::jsonb);
    v_config := jsonb_set(v_config, '{restricoes}', '{"HGU": "NÃO ATENDE HGU", "URGENCIA": "NÃO ACEITA ENCAIXE DE URGÊNCIA"}'::jsonb);

    -- Remove convenios_restricoes that reference HGU
    IF v_config ? 'convenios_restricoes' THEN
      v_config := v_config #- '{convenios_restricoes}';
    END IF;

    UPDATE business_rules
    SET config = v_config,
        updated_at = now()
    WHERE id = v_br_id;
  END IF;
END $$;
