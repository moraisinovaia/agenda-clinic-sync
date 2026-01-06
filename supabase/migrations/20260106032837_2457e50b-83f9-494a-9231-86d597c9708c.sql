-- Corrigir função get_business_rules_with_services para contar objetos ao invés de arrays
CREATE OR REPLACE FUNCTION public.get_business_rules_with_services(p_cliente_id UUID)
RETURNS TABLE(
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
    m.nome::TEXT as medico_nome,
    (SELECT COUNT(*)::INTEGER FROM jsonb_object_keys(COALESCE(br.config->'servicos', '{}'::jsonb))) as servicos_count,
    br.config
  FROM business_rules br
  JOIN medicos m ON m.id = br.medico_id
  WHERE br.cliente_id = p_cliente_id
    AND br.ativo = true;
END;
$$;

-- Popular campo horarios dos médicos existentes com dados da business_rules
UPDATE medicos m
SET horarios = COALESCE(m.horarios, '{}'::jsonb) || jsonb_build_object(
  'tipo_agendamento', COALESCE(br.config->>'tipo_agendamento', 'ordem_chegada'),
  'permite_agendamento_online', COALESCE((br.config->>'permite_agendamento_online')::boolean, true)
)
FROM business_rules br
WHERE br.medico_id = m.id
  AND br.ativo = true
  AND (
    m.horarios IS NULL 
    OR m.horarios->>'tipo_agendamento' IS NULL
  );