
-- Criar função para atualizar business_rules de forma segura
CREATE OR REPLACE FUNCTION public.update_business_rules_config(
  p_medico_id uuid,
  p_config jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_business_rule_id uuid;
BEGIN
  -- Buscar business_rule existente
  SELECT id INTO v_business_rule_id
  FROM business_rules
  WHERE medico_id = p_medico_id AND ativo = true
  LIMIT 1;
  
  IF v_business_rule_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Business rule não encontrada para este médico'
    );
  END IF;
  
  -- Atualizar config
  UPDATE business_rules 
  SET config = p_config, updated_at = now()
  WHERE id = v_business_rule_id;
  
  RETURN json_build_object(
    'success', true,
    'business_rule_id', v_business_rule_id,
    'message', 'Configuração atualizada com sucesso'
  );
END;
$$;

-- Criar função para inserir mensagens LLM
CREATE OR REPLACE FUNCTION public.insert_llm_mensagem(
  p_cliente_id uuid,
  p_medico_id uuid,
  p_tipo text,
  p_mensagem text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Verificar se já existe
  SELECT id INTO v_id
  FROM llm_mensagens
  WHERE cliente_id = p_cliente_id 
    AND (p_medico_id IS NULL AND medico_id IS NULL OR medico_id = p_medico_id)
    AND tipo = p_tipo;
  
  IF v_id IS NOT NULL THEN
    -- Atualizar existente
    UPDATE llm_mensagens 
    SET mensagem = p_mensagem
    WHERE id = v_id;
    
    RETURN json_build_object('success', true, 'id', v_id, 'action', 'updated');
  ELSE
    -- Inserir novo
    INSERT INTO llm_mensagens (cliente_id, medico_id, tipo, mensagem, ativo)
    VALUES (p_cliente_id, p_medico_id, p_tipo, p_mensagem, true)
    RETURNING id INTO v_id;
    
    RETURN json_build_object('success', true, 'id', v_id, 'action', 'inserted');
  END IF;
END;
$$;
