-- Atualizar a função load_llm_config_for_clinic para incluir CRM/RQE
CREATE OR REPLACE FUNCTION public.load_llm_config_for_clinic(p_cliente_id uuid)
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
BEGIN
  -- Buscar configurações da clínica
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

  -- Buscar business_rules com CRM/RQE do médico
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
  WHERE br.cliente_id = p_cliente_id AND br.ativo = true;

  -- Buscar mensagens configuradas
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
  WHERE lm.cliente_id = p_cliente_id AND lm.ativo = true;

  -- Montar resultado final
  result := jsonb_build_object(
    'clinic_info', COALESCE(clinic_config, '{}'::jsonb),
    'business_rules', COALESCE(business_rules_data, '{}'::jsonb),
    'mensagens', COALESCE(mensagens_data, '{}'::jsonb),
    'loaded_at', now()
  );

  RETURN result;
END;
$$;