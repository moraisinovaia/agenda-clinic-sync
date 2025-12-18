
-- Função para sincronizar automaticamente medicos → business_rules
CREATE OR REPLACE FUNCTION sync_medico_to_business_rules()
RETURNS TRIGGER AS $$
DECLARE
  v_existing_rule_id UUID;
  v_default_config JSONB;
BEGIN
  -- Só sincronizar se o médico está ativo
  IF NEW.ativo = false THEN
    -- Se médico foi desativado, desativar a business_rule correspondente
    UPDATE business_rules 
    SET ativo = false, updated_at = now()
    WHERE medico_id = NEW.id AND cliente_id = NEW.cliente_id;
    RETURN NEW;
  END IF;

  -- Verificar se já existe uma regra para este médico
  SELECT id INTO v_existing_rule_id 
  FROM business_rules 
  WHERE medico_id = NEW.id AND cliente_id = NEW.cliente_id;

  -- Configuração padrão para novos médicos
  v_default_config := jsonb_build_object(
    'nome', NEW.nome,
    'tipo_agendamento', COALESCE((NEW.horarios->>'tipo_agendamento'), 'ordem_chegada'),
    'permite_agendamento_online', COALESCE((NEW.horarios->>'permite_agendamento_online')::boolean, true),
    'convenios', COALESCE(to_jsonb(NEW.convenios_aceitos), '[]'::jsonb),
    'idade_minima', COALESCE(NEW.idade_minima, 0),
    'idade_maxima', NEW.idade_maxima,
    'servicos', '[]'::jsonb,
    'periodos', '{}'::jsonb,
    'limite_pacientes', NULL
  );

  IF v_existing_rule_id IS NULL THEN
    -- Criar nova regra de negócio
    INSERT INTO business_rules (
      cliente_id,
      medico_id,
      config,
      ativo,
      version
    ) VALUES (
      NEW.cliente_id,
      NEW.id,
      v_default_config,
      true,
      1
    );
  ELSE
    -- Atualizar regra existente (preservando campos avançados)
    UPDATE business_rules 
    SET 
      config = config || jsonb_build_object(
        'nome', NEW.nome,
        'convenios', COALESCE(to_jsonb(NEW.convenios_aceitos), config->'convenios'),
        'idade_minima', COALESCE(NEW.idade_minima, 0),
        'idade_maxima', NEW.idade_maxima,
        'tipo_agendamento', COALESCE((NEW.horarios->>'tipo_agendamento'), config->>'tipo_agendamento', 'ordem_chegada'),
        'permite_agendamento_online', COALESCE((NEW.horarios->>'permite_agendamento_online')::boolean, (config->>'permite_agendamento_online')::boolean, true)
      ),
      ativo = true,
      updated_at = now(),
      version = version + 1
    WHERE id = v_existing_rule_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para sincronização automática
DROP TRIGGER IF EXISTS sync_medico_business_rules_trigger ON medicos;
CREATE TRIGGER sync_medico_business_rules_trigger
  AFTER INSERT OR UPDATE ON medicos
  FOR EACH ROW
  EXECUTE FUNCTION sync_medico_to_business_rules();

-- Comentário explicativo
COMMENT ON FUNCTION sync_medico_to_business_rules() IS 
  'Sincroniza automaticamente alterações em medicos para business_rules do LLM API';
