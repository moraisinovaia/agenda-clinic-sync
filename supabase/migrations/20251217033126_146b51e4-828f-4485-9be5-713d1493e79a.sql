-- ===================================================================
-- FASE 2: FUNÇÃO DE CARREGAMENTO COM CACHE
-- Função principal que carrega todas as configurações para Edge Functions
-- ===================================================================

-- ===================================================================
-- 1. FUNÇÃO: load_llm_config_for_clinic
-- Carrega configuração completa da clínica em uma única query
-- ===================================================================

CREATE OR REPLACE FUNCTION load_llm_config_for_clinic(p_cliente_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_clinic_config JSONB;
  v_business_rules JSONB;
  v_mensagens JSONB;
BEGIN
  -- 1. Carregar configuração da clínica
  SELECT jsonb_build_object(
    'nome_clinica', nome_clinica,
    'telefone', telefone,
    'whatsapp', whatsapp,
    'endereco', endereco,
    'data_minima_agendamento', data_minima_agendamento,
    'mensagem_bloqueio_padrao', mensagem_bloqueio_padrao,
    'dias_busca_inicial', dias_busca_inicial,
    'dias_busca_expandida', dias_busca_expandida
  )
  INTO v_clinic_config
  FROM llm_clinic_config
  WHERE cliente_id = p_cliente_id
    AND ativo = true
  LIMIT 1;

  -- Se não encontrou config da clínica, retornar null
  IF v_clinic_config IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Clínica não configurada para LLM API',
      'cliente_id', p_cliente_id
    );
  END IF;

  -- 2. Carregar business_rules de todos os médicos da clínica
  SELECT jsonb_object_agg(
    br.medico_id::text,
    jsonb_build_object(
      'id', br.id,
      'medico_id', br.medico_id,
      'medico_nome', m.nome,
      'config', br.config,
      'version', br.version
    )
  )
  INTO v_business_rules
  FROM business_rules br
  JOIN medicos m ON m.id = br.medico_id
  WHERE br.cliente_id = p_cliente_id
    AND br.ativo = true
    AND m.ativo = true;

  -- 3. Carregar mensagens personalizadas
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'medico_id', medico_id,
      'tipo', tipo,
      'mensagem', mensagem
    )
  )
  INTO v_mensagens
  FROM llm_mensagens
  WHERE cliente_id = p_cliente_id
    AND ativo = true;

  -- 4. Montar resultado final
  v_result := jsonb_build_object(
    'success', true,
    'loaded_at', now(),
    'cliente_id', p_cliente_id,
    'clinic_info', v_clinic_config,
    'business_rules', COALESCE(v_business_rules, '{}'::jsonb),
    'mensagens', COALESCE(v_mensagens, '[]'::jsonb),
    'total_medicos', (SELECT COUNT(*) FROM business_rules WHERE cliente_id = p_cliente_id AND ativo = true)
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION load_llm_config_for_clinic IS 'Carrega configuração completa da clínica para LLM API em uma única chamada otimizada';

-- ===================================================================
-- 2. FUNÇÃO: get_business_rule_for_doctor
-- Busca regra específica de um médico (para consultas pontuais)
-- ===================================================================

CREATE OR REPLACE FUNCTION get_business_rule_for_doctor(
  p_cliente_id UUID,
  p_medico_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'success', true,
    'medico_id', br.medico_id,
    'medico_nome', m.nome,
    'config', br.config,
    'version', br.version,
    'updated_at', br.updated_at
  )
  INTO v_result
  FROM business_rules br
  JOIN medicos m ON m.id = br.medico_id
  WHERE br.cliente_id = p_cliente_id
    AND br.medico_id = p_medico_id
    AND br.ativo = true
    AND m.ativo = true;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Médico não encontrado ou sem configuração',
      'medico_id', p_medico_id
    );
  END IF;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_business_rule_for_doctor IS 'Busca regra de negócio específica de um médico';

-- ===================================================================
-- 3. FUNÇÃO: get_mensagem_personalizada
-- Busca mensagem específica (com fallback para global)
-- ===================================================================

CREATE OR REPLACE FUNCTION get_mensagem_personalizada(
  p_cliente_id UUID,
  p_tipo TEXT,
  p_medico_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mensagem TEXT;
BEGIN
  -- Primeiro tenta buscar mensagem específica do médico
  IF p_medico_id IS NOT NULL THEN
    SELECT mensagem INTO v_mensagem
    FROM llm_mensagens
    WHERE cliente_id = p_cliente_id
      AND medico_id = p_medico_id
      AND tipo = p_tipo
      AND ativo = true
    LIMIT 1;
    
    IF v_mensagem IS NOT NULL THEN
      RETURN v_mensagem;
    END IF;
  END IF;
  
  -- Fallback para mensagem global da clínica
  SELECT mensagem INTO v_mensagem
  FROM llm_mensagens
  WHERE cliente_id = p_cliente_id
    AND medico_id IS NULL
    AND tipo = p_tipo
    AND ativo = true
  LIMIT 1;
  
  RETURN v_mensagem;
END;
$$;

COMMENT ON FUNCTION get_mensagem_personalizada IS 'Busca mensagem personalizada com fallback para global';

-- ===================================================================
-- 4. FUNÇÃO: upsert_business_rule
-- Criar ou atualizar business_rule de um médico
-- ===================================================================

CREATE OR REPLACE FUNCTION upsert_business_rule(
  p_cliente_id UUID,
  p_medico_id UUID,
  p_config JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result_id UUID;
  v_is_new BOOLEAN := false;
BEGIN
  -- Verificar se já existe
  SELECT id INTO v_result_id
  FROM business_rules
  WHERE cliente_id = p_cliente_id
    AND medico_id = p_medico_id;

  IF v_result_id IS NULL THEN
    -- INSERT
    INSERT INTO business_rules (cliente_id, medico_id, config)
    VALUES (p_cliente_id, p_medico_id, p_config)
    RETURNING id INTO v_result_id;
    v_is_new := true;
  ELSE
    -- UPDATE (trigger de auditoria será disparado automaticamente)
    UPDATE business_rules
    SET config = p_config
    WHERE id = v_result_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_result_id,
    'action', CASE WHEN v_is_new THEN 'created' ELSE 'updated' END,
    'medico_id', p_medico_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION upsert_business_rule IS 'Cria ou atualiza business_rule de um médico';

-- ===================================================================
-- 5. FUNÇÃO: search_doctor_by_name_llm
-- Busca médico por nome (para LLM API) - nome único para evitar conflito
-- ===================================================================

CREATE OR REPLACE FUNCTION search_doctor_by_name_llm(
  p_cliente_id UUID,
  p_nome_busca TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_results JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'medico_id', m.id,
      'nome', m.nome,
      'especialidade', m.especialidade,
      'convenios_aceitos', m.convenios_aceitos,
      'has_business_rules', EXISTS (
        SELECT 1 FROM business_rules br 
        WHERE br.medico_id = m.id AND br.ativo = true
      )
    )
  )
  INTO v_results
  FROM medicos m
  WHERE m.cliente_id = p_cliente_id
    AND m.ativo = true
    AND (
      -- Busca case-insensitive
      lower(m.nome) LIKE '%' || lower(p_nome_busca) || '%'
    );

  IF v_results IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'found', false,
      'results', '[]'::jsonb
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'found', true,
    'count', jsonb_array_length(v_results),
    'results', v_results
  );
END;
$$;

COMMENT ON FUNCTION search_doctor_by_name_llm IS 'Busca médicos por nome para LLM API';

-- ===================================================================
-- 6. GRANTS
-- ===================================================================

GRANT EXECUTE ON FUNCTION load_llm_config_for_clinic TO service_role;
GRANT EXECUTE ON FUNCTION get_business_rule_for_doctor TO service_role;
GRANT EXECUTE ON FUNCTION get_mensagem_personalizada TO service_role;
GRANT EXECUTE ON FUNCTION upsert_business_rule TO service_role;
GRANT EXECUTE ON FUNCTION search_doctor_by_name_llm TO service_role;

GRANT EXECUTE ON FUNCTION load_llm_config_for_clinic TO authenticated;
GRANT EXECUTE ON FUNCTION get_business_rule_for_doctor TO authenticated;
GRANT EXECUTE ON FUNCTION get_mensagem_personalizada TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_business_rule TO authenticated;
GRANT EXECUTE ON FUNCTION search_doctor_by_name_llm TO authenticated;

-- ===================================================================
-- 7. LOG DA OPERAÇÃO
-- ===================================================================

INSERT INTO public.system_logs (timestamp, level, message, context, data)
VALUES (
  now(),
  'info',
  '[DATABASE] Fase 2 LLM API Dinâmica - Funções de carregamento criadas',
  'LLM_API_MIGRATION',
  jsonb_build_object(
    'fase', 2,
    'funcoes_criadas', ARRAY[
      'load_llm_config_for_clinic',
      'get_business_rule_for_doctor', 
      'get_mensagem_personalizada',
      'upsert_business_rule',
      'search_doctor_by_name_llm'
    ],
    'timestamp', now()
  )
);