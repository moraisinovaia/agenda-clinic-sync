-- Create RPC function to get recent activity metrics per clinic
CREATE OR REPLACE FUNCTION get_clinic_recent_activity()
RETURNS TABLE (
  cliente_id UUID,
  agendamentos_7_dias BIGINT,
  agendamentos_30_dias BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as cliente_id,
    COUNT(a.id) FILTER (WHERE a.data_agendamento >= CURRENT_DATE - INTERVAL '7 days' AND a.status NOT IN ('excluido', 'cancelado')) as agendamentos_7_dias,
    COUNT(a.id) FILTER (WHERE a.data_agendamento >= CURRENT_DATE - INTERVAL '30 days' AND a.status NOT IN ('excluido', 'cancelado')) as agendamentos_30_dias
  FROM clientes c
  LEFT JOIN agendamentos a ON a.cliente_id = c.id
  WHERE c.ativo = true
  GROUP BY c.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_clinic_recent_activity() TO authenticated;