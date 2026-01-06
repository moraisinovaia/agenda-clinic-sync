-- Função para sincronizar dados do médico com business_rules
CREATE OR REPLACE FUNCTION sync_medico_to_business_rules(p_medico_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_medico RECORD;
  v_business_rule RECORD;
  v_updated_config JSONB;
BEGIN
  -- Buscar dados do médico
  SELECT * INTO v_medico FROM medicos WHERE id = p_medico_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Médico não encontrado');
  END IF;
  
  -- Buscar business_rule existente
  SELECT * INTO v_business_rule FROM business_rules WHERE medico_id = p_medico_id;
  
  IF NOT FOUND THEN
    -- Criar nova business_rule se não existir
    INSERT INTO business_rules (
      cliente_id,
      medico_id,
      config,
      ativo,
      version
    ) VALUES (
      v_medico.cliente_id,
      p_medico_id,
      jsonb_build_object(
        'convenios', COALESCE(v_medico.convenios_aceitos, ARRAY[]::text[]),
        'idade_minima', COALESCE(v_medico.idade_minima, 0),
        'idade_maxima', v_medico.idade_maxima,
        'tipo_agendamento', COALESCE((v_medico.horarios->>'tipo_agendamento')::text, 'ordem_chegada'),
        'permite_agendamento_online', COALESCE((v_medico.horarios->>'permite_agendamento_online')::boolean, true),
        'servicos', '[]'::jsonb
      ),
      true,
      1
    );
    
    RETURN jsonb_build_object('success', true, 'message', 'Business rule criada com sucesso');
  END IF;
  
  -- Atualizar business_rule existente mantendo servicos e periodos
  v_updated_config := v_business_rule.config;
  
  -- Atualizar campos específicos
  v_updated_config := jsonb_set(v_updated_config, '{convenios}', to_jsonb(COALESCE(v_medico.convenios_aceitos, ARRAY[]::text[])));
  v_updated_config := jsonb_set(v_updated_config, '{idade_minima}', to_jsonb(COALESCE(v_medico.idade_minima, 0)));
  
  IF v_medico.idade_maxima IS NOT NULL THEN
    v_updated_config := jsonb_set(v_updated_config, '{idade_maxima}', to_jsonb(v_medico.idade_maxima));
  ELSE
    v_updated_config := v_updated_config - 'idade_maxima';
  END IF;
  
  v_updated_config := jsonb_set(v_updated_config, '{tipo_agendamento}', to_jsonb(COALESCE((v_medico.horarios->>'tipo_agendamento')::text, 'ordem_chegada')));
  v_updated_config := jsonb_set(v_updated_config, '{permite_agendamento_online}', to_jsonb(COALESCE((v_medico.horarios->>'permite_agendamento_online')::boolean, true)));
  
  -- Atualizar registro
  UPDATE business_rules 
  SET 
    config = v_updated_config,
    updated_at = now(),
    version = COALESCE(version, 0) + 1
  WHERE medico_id = p_medico_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Business rule sincronizada com sucesso');
END;
$$;

-- Função para buscar business_rules com quantidade de serviços
CREATE OR REPLACE FUNCTION get_business_rules_with_services(p_cliente_id UUID)
RETURNS TABLE (
  medico_id UUID,
  medico_nome TEXT,
  servicos_count INTEGER,
  config JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    br.medico_id,
    m.nome as medico_nome,
    COALESCE(jsonb_array_length(br.config->'servicos'), 0)::INTEGER as servicos_count,
    br.config
  FROM business_rules br
  JOIN medicos m ON m.id = br.medico_id
  WHERE br.cliente_id = p_cliente_id
    AND br.ativo = true
    AND m.ativo = true
  ORDER BY m.nome;
END;
$$;

-- Trigger para sincronizar automaticamente quando médico é atualizado
CREATE OR REPLACE FUNCTION trigger_sync_medico_to_business_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se campos relevantes foram alterados
  IF (OLD.convenios_aceitos IS DISTINCT FROM NEW.convenios_aceitos) OR
     (OLD.idade_minima IS DISTINCT FROM NEW.idade_minima) OR
     (OLD.idade_maxima IS DISTINCT FROM NEW.idade_maxima) OR
     (OLD.horarios IS DISTINCT FROM NEW.horarios) THEN
    
    PERFORM sync_medico_to_business_rules(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_medico_sync_business_rules ON medicos;

-- Criar trigger
CREATE TRIGGER trigger_medico_sync_business_rules
  AFTER UPDATE ON medicos
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_medico_to_business_rules();

-- Conceder permissões
GRANT EXECUTE ON FUNCTION sync_medico_to_business_rules(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_business_rules_with_services(UUID) TO authenticated;