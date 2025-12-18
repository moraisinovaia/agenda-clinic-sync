-- Fase 1: Adicionar coluna limite_pacientes
ALTER TABLE horarios_configuracao 
ADD COLUMN IF NOT EXISTS limite_pacientes integer DEFAULT NULL;

COMMENT ON COLUMN horarios_configuracao.limite_pacientes IS 'Limite máximo de pacientes por período. NULL significa sem limite definido.';

-- Fase 2: Criar função de sincronização de horários para business_rules
CREATE OR REPLACE FUNCTION sync_horarios_to_business_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_medico_id uuid;
  v_cliente_id uuid;
  v_business_rule_id uuid;
  v_current_config jsonb;
  v_servicos_config jsonb;
  v_primeiro_servico text;
  v_horarios record;
  v_periodos jsonb;
  v_periodo_key text;
  v_dias_array integer[];
BEGIN
  -- Determinar medico_id e cliente_id baseado na operação
  IF TG_OP = 'DELETE' THEN
    v_medico_id := OLD.medico_id;
    v_cliente_id := OLD.cliente_id;
  ELSE
    v_medico_id := NEW.medico_id;
    v_cliente_id := NEW.cliente_id;
  END IF;

  -- Buscar business_rule existente
  SELECT id, config INTO v_business_rule_id, v_current_config
  FROM business_rules
  WHERE medico_id = v_medico_id AND cliente_id = v_cliente_id AND ativo = true
  LIMIT 1;

  -- Se não existe business_rule, não sincronizar (será criado pelo trigger do médico)
  IF v_business_rule_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Buscar o primeiro serviço ativo do médico (para usar como chave)
  SELECT nome INTO v_primeiro_servico
  FROM atendimentos
  WHERE (medico_id = v_medico_id OR medico_id IS NULL)
    AND cliente_id = v_cliente_id
    AND ativo = true
  ORDER BY created_at
  LIMIT 1;

  -- Se não há serviço, usar nome genérico
  IF v_primeiro_servico IS NULL THEN
    v_primeiro_servico := 'Serviço Principal';
  END IF;

  -- Construir estrutura de períodos a partir de horarios_configuracao
  v_periodos := '{}'::jsonb;
  
  -- Agregar por período, coletando dias específicos e calculando início/fim mais abrangentes
  FOR v_horarios IN 
    SELECT 
      periodo,
      MIN(hora_inicio::text) as hora_inicio,
      MAX(hora_fim::text) as hora_fim,
      MAX(limite_pacientes) as limite,
      array_agg(DISTINCT dia_semana ORDER BY dia_semana) as dias
    FROM horarios_configuracao
    WHERE medico_id = v_medico_id 
      AND cliente_id = v_cliente_id 
      AND ativo = true
    GROUP BY periodo
  LOOP
    v_periodo_key := v_horarios.periodo;
    
    v_periodos := v_periodos || jsonb_build_object(
      v_periodo_key, jsonb_build_object(
        'inicio', v_horarios.hora_inicio,
        'fim', v_horarios.hora_fim,
        'limite', COALESCE(v_horarios.limite, 10),
        'dias_especificos', to_jsonb(v_horarios.dias)
      )
    );
  END LOOP;

  -- Construir estrutura de serviços
  v_servicos_config := jsonb_build_object(
    v_primeiro_servico, jsonb_build_object(
      'periodos', v_periodos
    )
  );

  -- Atualizar business_rules.config.servicos preservando outros campos
  v_current_config := COALESCE(v_current_config, '{}'::jsonb);
  v_current_config := v_current_config || jsonb_build_object('servicos', v_servicos_config);

  -- Salvar atualização
  UPDATE business_rules
  SET config = v_current_config,
      updated_at = now()
  WHERE id = v_business_rule_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fase 3: Criar trigger na tabela horarios_configuracao
DROP TRIGGER IF EXISTS sync_horarios_business_rules_trigger ON horarios_configuracao;

CREATE TRIGGER sync_horarios_business_rules_trigger
AFTER INSERT OR UPDATE OR DELETE ON horarios_configuracao
FOR EACH ROW
EXECUTE FUNCTION sync_horarios_to_business_rules();

-- Fase 4: Backfill - Popular business_rules.config.servicos para médicos existentes
-- Executar a sincronização para todos os médicos que têm horarios_configuracao

DO $$
DECLARE
  v_medico record;
  v_cliente_id uuid;
  v_business_rule_id uuid;
  v_current_config jsonb;
  v_servicos_config jsonb;
  v_primeiro_servico text;
  v_horarios record;
  v_periodos jsonb;
  v_periodo_key text;
BEGIN
  -- Para cada médico com horarios_configuracao
  FOR v_medico IN 
    SELECT DISTINCT medico_id, cliente_id 
    FROM horarios_configuracao 
    WHERE ativo = true
  LOOP
    -- Buscar business_rule existente
    SELECT id, config INTO v_business_rule_id, v_current_config
    FROM business_rules
    WHERE medico_id = v_medico.medico_id 
      AND cliente_id = v_medico.cliente_id 
      AND ativo = true
    LIMIT 1;

    -- Se não existe business_rule, pular
    IF v_business_rule_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Buscar o primeiro serviço ativo do médico
    SELECT nome INTO v_primeiro_servico
    FROM atendimentos
    WHERE (medico_id = v_medico.medico_id OR medico_id IS NULL)
      AND cliente_id = v_medico.cliente_id
      AND ativo = true
    ORDER BY created_at
    LIMIT 1;

    IF v_primeiro_servico IS NULL THEN
      v_primeiro_servico := 'Serviço Principal';
    END IF;

    -- Construir estrutura de períodos
    v_periodos := '{}'::jsonb;
    
    FOR v_horarios IN 
      SELECT 
        periodo,
        MIN(hora_inicio::text) as hora_inicio,
        MAX(hora_fim::text) as hora_fim,
        MAX(COALESCE(limite_pacientes, 10)) as limite,
        array_agg(DISTINCT dia_semana ORDER BY dia_semana) as dias
      FROM horarios_configuracao
      WHERE medico_id = v_medico.medico_id 
        AND cliente_id = v_medico.cliente_id 
        AND ativo = true
      GROUP BY periodo
    LOOP
      v_periodo_key := v_horarios.periodo;
      
      v_periodos := v_periodos || jsonb_build_object(
        v_periodo_key, jsonb_build_object(
          'inicio', v_horarios.hora_inicio,
          'fim', v_horarios.hora_fim,
          'limite', v_horarios.limite,
          'dias_especificos', to_jsonb(v_horarios.dias)
        )
      );
    END LOOP;

    -- Construir estrutura de serviços
    v_servicos_config := jsonb_build_object(
      v_primeiro_servico, jsonb_build_object(
        'periodos', v_periodos
      )
    );

    -- Atualizar business_rules
    v_current_config := COALESCE(v_current_config, '{}'::jsonb);
    v_current_config := v_current_config || jsonb_build_object('servicos', v_servicos_config);

    UPDATE business_rules
    SET config = v_current_config,
        updated_at = now()
    WHERE id = v_business_rule_id;

    RAISE NOTICE 'Backfilled business_rules for medico_id: %', v_medico.medico_id;
  END LOOP;
END;
$$;