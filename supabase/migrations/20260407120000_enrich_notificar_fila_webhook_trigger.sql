-- Enriquece notificar_fila_webhook() com os campos que o adapter adicionava:
--   tipo_agenda, horario_inicio, horario_fim, evolution_instance_name
--
-- Elimina duplicidade de notificação:
-- antes → trigger (payload parcial) + adapter fetch (payload completo) = 2 POSTs
-- depois → trigger (payload completo) = 1 POST

CREATE OR REPLACE FUNCTION public.notificar_fila_webhook()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_fila_record    RECORD;
  v_br_config      JSONB;
  v_servico_key    TEXT;
  v_servico_cfg    JSONB;
  v_periodo_cfg    JSONB;
  v_periodo_nome   TEXT;
  v_hora_num       INTEGER;
  v_tipo_raw       TEXT;
  v_tipo_agenda    TEXT := 'hora_marcada';
  v_horario_inicio TEXT := NULL;
  v_horario_fim    TEXT := NULL;
  v_evolution      TEXT := NULL;
  payload          JSONB;
BEGIN
  -- 1. Dados básicos via joins
  SELECT
    p.nome_completo  AS paciente_nome,
    p.celular        AS paciente_celular,
    m.nome           AS medico_nome,
    a.nome           AS atendimento_nome,
    fe.cliente_id,
    fe.medico_id
  INTO v_fila_record
  FROM fila_espera fe
  JOIN pacientes   p ON fe.paciente_id   = p.id
  JOIN medicos     m ON fe.medico_id     = m.id
  JOIN atendimentos a ON fe.atendimento_id = a.id
  WHERE fe.id = NEW.fila_id;

  -- 2. business_rules do médico para tipo_agenda e horários
  SELECT br.config INTO v_br_config
  FROM business_rules br
  WHERE br.medico_id  = v_fila_record.medico_id
    AND br.cliente_id = v_fila_record.cliente_id
    AND br.ativo      = true
  LIMIT 1;

  IF v_br_config IS NOT NULL THEN
    v_hora_num     := EXTRACT(HOUR FROM NEW.hora_agendamento)::integer;
    v_periodo_nome := CASE WHEN v_hora_num < 12 THEN 'manha' ELSE 'tarde' END;

    IF jsonb_typeof(v_br_config->'servicos') = 'object' THEN
      FOR v_servico_key, v_servico_cfg IN
        SELECT key, value FROM jsonb_each(v_br_config->'servicos')
      LOOP
        v_periodo_cfg := v_servico_cfg->'periodos'->v_periodo_nome;
        IF v_periodo_cfg IS NOT NULL
           AND (v_periodo_cfg->>'ativo')::boolean IS NOT FALSE THEN
          v_tipo_raw := COALESCE(
            v_servico_cfg->>'tipo_agendamento',
            v_br_config->>'tipo_agendamento',
            'ordem_chegada'
          );
          EXIT;
        END IF;
      END LOOP;
    END IF;

    IF v_tipo_raw IS NULL THEN
      v_tipo_raw := COALESCE(v_br_config->>'tipo_agendamento', 'ordem_chegada');
    END IF;

    v_tipo_agenda := CASE
      WHEN v_tipo_raw = 'hora_marcada' THEN 'hora_marcada'
      ELSE 'ordem_chegada'
    END;

    IF v_tipo_agenda = 'ordem_chegada' AND v_periodo_cfg IS NOT NULL THEN
      v_horario_inicio := COALESCE(
        v_periodo_cfg->>'inicio',
        v_periodo_cfg->>'horario_inicio'
      );
      v_horario_fim := COALESCE(
        v_periodo_cfg->>'fim',
        v_periodo_cfg->>'horario_fim'
      );
    END IF;
  END IF;

  -- 3. evolution_instance_name da clínica
  SELECT cc.valor INTO v_evolution
  FROM configuracoes_clinica cc
  WHERE cc.cliente_id = v_fila_record.cliente_id
    AND cc.chave      = 'evolution_instance_name'
    AND cc.ativo      = true
  LIMIT 1;

  -- 4. Montar payload completo e disparar
  payload := jsonb_build_object(
    'notif_id',               NEW.id,
    'fila_id',                NEW.fila_id,
    'cliente_id',             v_fila_record.cliente_id,
    'paciente_nome',          v_fila_record.paciente_nome,
    'paciente_celular',       v_fila_record.paciente_celular,
    'medico_nome',            v_fila_record.medico_nome,
    'atendimento_nome',       v_fila_record.atendimento_nome,
    'data_agendamento',       NEW.data_agendamento,
    'hora_agendamento',       NEW.hora_agendamento,
    'tempo_limite',           NEW.tempo_limite,
    'tipo_agenda',            v_tipo_agenda,
    'horario_inicio',         v_horario_inicio,
    'horario_fim',            v_horario_fim,
    'evolution_instance_name', v_evolution
  );

  PERFORM net.http_post(
    url     := 'https://n8n-medical.inovaia-automacao.com.br/webhook/fila-espera-notificar',
    body    := payload,
    headers := jsonb_build_object('Content-Type', 'application/json')
  );

  RETURN NEW;
END;
$$;
