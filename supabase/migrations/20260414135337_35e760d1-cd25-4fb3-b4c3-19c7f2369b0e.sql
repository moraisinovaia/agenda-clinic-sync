
DO $$
DECLARE
  v_br_id uuid := 'a31e0c87-6d42-4ed2-8f69-517d13931e75';
  v_config jsonb;
  v_servicos jsonb;
  v_key text;
  v_srv jsonb;
  v_manha_period jsonb;
  v_tarde_period jsonb;
BEGIN
  SELECT config INTO v_config FROM business_rules WHERE id = v_br_id;

  -- 1) Update limite_por_turno to 20
  v_config := jsonb_set(v_config, '{limite_por_turno}', '20'::jsonb);

  -- 2) Update HGU limits to 5
  v_config := jsonb_set(v_config, '{limite_hgu}', '5'::jsonb);
  v_config := jsonb_set(v_config, '{convenio_sublimites,HGU}', '5'::jsonb);

  -- 3) Update observacoes
  v_config := jsonb_set(v_config, '{observacoes}', '"HGU: máximo 5 pacientes por turno. Possui RQE. Máximo 20 pacientes por turno."'::jsonb);

  -- 4) Define standard periods
  v_manha_period := '{
    "ativo": true,
    "inicio": "08:00",
    "fim": "09:30",
    "limite": 20,
    "limite_pacientes": 20,
    "distribuicao_fichas": "08:00 às 09:30",
    "atendimento_inicio": "08:00",
    "contagem_inicio": "07:00",
    "contagem_fim": "12:00"
  }'::jsonb;

  v_tarde_period := '{
    "ativo": true,
    "inicio": "13:30",
    "fim": "15:00",
    "limite": 20,
    "limite_pacientes": 20,
    "distribuicao_fichas": "13:30 às 15:00",
    "atendimento_inicio": "13:30",
    "contagem_inicio": "12:00",
    "contagem_fim": "18:00"
  }'::jsonb;

  -- 5) Update root periodos
  v_config := jsonb_set(v_config, '{periodos}', jsonb_build_object('manha', v_manha_period, 'tarde', v_tarde_period));

  -- 6) Update all services with both periods, correct dias_semana, and limite 20
  v_servicos := v_config->'servicos';
  FOR v_key IN SELECT * FROM jsonb_object_keys(v_servicos)
  LOOP
    v_srv := v_servicos->v_key;
    -- Set dias_semana to [3,4] (quarta manhã, quinta tarde)
    v_srv := jsonb_set(v_srv, '{dias_semana}', '[3,4]'::jsonb);
    -- Set both periods
    v_srv := jsonb_set(v_srv, '{periodos}', jsonb_build_object('manha', v_manha_period, 'tarde', v_tarde_period));
    v_servicos := jsonb_set(v_servicos, ARRAY[v_key], v_srv);
  END LOOP;

  v_config := jsonb_set(v_config, '{servicos}', v_servicos);

  -- 7) Save
  UPDATE business_rules
  SET config = v_config, updated_at = now()
  WHERE id = v_br_id;

  -- 8) Update medicos.observacoes
  UPDATE medicos
  SET observacoes = 'Oftalmologia geral, catarata, pterígio. HGU: máximo 5 pacientes por turno. Máximo 20 pacientes por turno. Dilatação: 0-39 anos dilata (exceto ceratocone), 40-59 não dilata (exceto diabéticos), 60+ sempre dilata.'
  WHERE id = 'ec1a794c-9ec2-4f70-b86a-6a47c1b659ff';
END $$;
