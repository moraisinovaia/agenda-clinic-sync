
DO $$
DECLARE
  v_medico_id uuid := 'a38f801c-54fa-4676-b677-7593f05a527e';
  v_cliente_id uuid := '0b6a0a35-0059-4a0c-9fb8-413b6253c2ad';
BEGIN
  -- 1. Add UNIMED INTERCÂMBIO to convenios_aceitos
  UPDATE public.medicos
  SET convenios_aceitos = ARRAY['PARTICULAR','UNIMED NACIONAL','UNIMED REGIONAL','UNIMED 20%','UNIMED 40%','UNIMED INTERCÂMBIO','AMIL','HAPVIDA','MEDPREV','HGU','SELECT']
  WHERE id = v_medico_id AND cliente_id = v_cliente_id;

  -- 2. Update business_rules: tipo_agendamento → ordem_chegada, permite_agendamento_online → true, add UNIMED INTERCÂMBIO, permite_online → true
  UPDATE public.business_rules
  SET config = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          config,
          '{tipo_agendamento}', '"ordem_chegada"'
        ),
        '{permite_agendamento_online}', 'true'
      ),
      '{convenios}', '["PARTICULAR","UNIMED NACIONAL","UNIMED REGIONAL","UNIMED 20%","UNIMED 40%","UNIMED INTERCÂMBIO","AMIL","HAPVIDA","MEDPREV","HGU","SELECT"]'
    ),
    '{servicos,0,permite_online}', 'true'
  )
  WHERE medico_id = v_medico_id AND cliente_id = v_cliente_id;
END $$;
