-- ============================================
-- PASSO 4: ATUALIZAR RPC PARA SUPORTAR config_id
-- Carrega configs por config_id quando fornecido
-- ============================================

CREATE OR REPLACE FUNCTION load_llm_config_for_clinic(
  p_cliente_id UUID DEFAULT NULL,
  p_config_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  clinic_config jsonb;
  business_rules_data jsonb;
  mensagens_data jsonb;
  v_config_id UUID;
BEGIN
  -- Determinar qual config_id usar
  -- Se p_config_id foi fornecido, usar diretamente
  -- Senão, buscar pelo cliente_id (comportamento legado)
  IF p_config_id IS NOT NULL THEN
    v_config_id := p_config_id;
    
    -- Buscar configurações da clínica pelo config_id
    SELECT jsonb_build_object(
      'id', lcc.id,
      'cliente_id', lcc.cliente_id,
      'nome_clinica', lcc.nome_clinica,
      'telefone', lcc.telefone,
      'whatsapp', lcc.whatsapp,
      'endereco', lcc.endereco,
      'mensagem_bloqueio_padrao', lcc.mensagem_bloqueio_padrao,
      'data_minima_agendamento', lcc.data_minima_agendamento,
      'dias_busca_inicial', lcc.dias_busca_inicial,
      'dias_busca_expandida', lcc.dias_busca_expandida,
      'ativo', lcc.ativo
    ) INTO clinic_config
    FROM llm_clinic_config lcc
    WHERE lcc.id = v_config_id AND lcc.ativo = true
    LIMIT 1;
  ELSE
    -- Comportamento legado: buscar por cliente_id
    SELECT lcc.id INTO v_config_id
    FROM llm_clinic_config lcc
    WHERE lcc.cliente_id = p_cliente_id AND lcc.ativo = true
    LIMIT 1;
    
    SELECT jsonb_build_object(
      'id', lcc.id,
      'cliente_id', lcc.cliente_id,
      'nome_clinica', lcc.nome_clinica,
      'telefone', lcc.telefone,
      'whatsapp', lcc.whatsapp,
      'endereco', lcc.endereco,
      'mensagem_bloqueio_padrao', lcc.mensagem_bloqueio_padrao,
      'data_minima_agendamento', lcc.data_minima_agendamento,
      'dias_busca_inicial', lcc.dias_busca_inicial,
      'dias_busca_expandida', lcc.dias_busca_expandida,
      'ativo', lcc.ativo
    ) INTO clinic_config
    FROM llm_clinic_config lcc
    WHERE lcc.cliente_id = p_cliente_id AND lcc.ativo = true
    LIMIT 1;
  END IF;

  -- Buscar business_rules usando config_id
  SELECT COALESCE(
    jsonb_object_agg(
      br.medico_id::text,
      jsonb_build_object(
        'id', br.id,
        'medico_id', br.medico_id,
        'medico_nome', m.nome,
        'crm', m.crm,
        'rqe', m.rqe,
        'config', br.config,
        'version', br.version,
        'ativo', br.ativo
      )
    ),
    '{}'::jsonb
  ) INTO business_rules_data
  FROM business_rules br
  LEFT JOIN medicos m ON m.id = br.medico_id
  WHERE br.config_id = v_config_id AND br.ativo = true;

  -- Buscar mensagens usando config_id
  SELECT COALESCE(
    jsonb_object_agg(
      COALESCE(lm.medico_id::text, 'geral') || '_' || lm.tipo,
      jsonb_build_object(
        'id', lm.id,
        'tipo', lm.tipo,
        'mensagem', lm.mensagem,
        'medico_id', lm.medico_id,
        'ativo', lm.ativo
      )
    ),
    '{}'::jsonb
  ) INTO mensagens_data
  FROM llm_mensagens lm
  WHERE lm.config_id = v_config_id AND lm.ativo = true;

  -- Montar resultado final
  result := jsonb_build_object(
    'clinic_info', COALESCE(clinic_config, '{}'::jsonb),
    'business_rules', COALESCE(business_rules_data, '{}'::jsonb),
    'mensagens', COALESCE(mensagens_data, '{}'::jsonb),
    'loaded_at', now(),
    'config_id_used', v_config_id
  );

  RETURN result;
END;
$$;