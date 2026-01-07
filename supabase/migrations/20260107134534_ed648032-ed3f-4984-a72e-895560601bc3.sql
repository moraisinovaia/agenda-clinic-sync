-- Primeiro dropar a função existente
DROP FUNCTION IF EXISTS get_agendamentos_completos(UUID, INTEGER);

-- Recriar função com tipos corretos (VARCHAR em vez de TEXT)
CREATE FUNCTION get_agendamentos_completos(
  p_cliente_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 10000
)
RETURNS TABLE(
  id UUID,
  paciente_id UUID,
  medico_id UUID,
  atendimento_id UUID,
  data_agendamento DATE,
  hora_agendamento TIME,
  status VARCHAR,
  convenio VARCHAR,
  observacoes TEXT,
  criado_por TEXT,
  criado_por_user_id UUID,
  alterado_por_user_id UUID,
  cancelado_por TEXT,
  cancelado_por_user_id UUID,
  cancelado_em TIMESTAMPTZ,
  confirmado_por TEXT,
  confirmado_por_user_id UUID,
  confirmado_em TIMESTAMPTZ,
  excluido_por TEXT,
  excluido_por_user_id UUID,
  excluido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  cliente_id UUID,
  paciente_nome TEXT,
  paciente_data_nascimento DATE,
  paciente_convenio VARCHAR,
  paciente_telefone TEXT,
  paciente_celular TEXT,
  medico_nome TEXT,
  medico_especialidade TEXT,
  atendimento_nome TEXT,
  atendimento_tipo TEXT,
  criado_por_profile_nome TEXT,
  criado_por_profile_email TEXT,
  alterado_por_profile_nome TEXT,
  alterado_por_profile_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.paciente_id,
    a.medico_id,
    a.atendimento_id,
    a.data_agendamento,
    a.hora_agendamento,
    a.status,
    a.convenio,
    a.observacoes,
    a.criado_por,
    a.criado_por_user_id,
    a.alterado_por_user_id,
    a.cancelado_por,
    a.cancelado_por_user_id,
    a.cancelado_em,
    a.confirmado_por,
    a.confirmado_por_user_id,
    a.confirmado_em,
    a.excluido_por,
    a.excluido_por_user_id,
    a.excluido_em,
    a.created_at,
    a.updated_at,
    a.cliente_id,
    p.nome_completo,
    p.data_nascimento,
    p.convenio,
    p.telefone,
    p.celular,
    m.nome,
    m.especialidade,
    at.nome,
    at.tipo,
    pc.nome,
    pc.email,
    pa.nome,
    pa.email
  FROM agendamentos a
  LEFT JOIN pacientes p ON a.paciente_id = p.id
  LEFT JOIN medicos m ON a.medico_id = m.id
  LEFT JOIN atendimentos at ON a.atendimento_id = at.id
  LEFT JOIN profiles pc ON a.criado_por_user_id = pc.user_id
  LEFT JOIN profiles pa ON a.alterado_por_user_id = pa.user_id
  WHERE 
    a.excluido_em IS NULL
    AND (p_cliente_id IS NULL OR a.cliente_id = p_cliente_id)
  ORDER BY a.data_agendamento DESC, a.hora_agendamento DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_agendamentos_completos(UUID, INTEGER) TO authenticated;