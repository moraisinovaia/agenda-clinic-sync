-- =============================================
-- RPC 1: Obter dados de autenticação do usuário em uma única chamada
-- Substitui 3 RPCs separadas (has_role, is_clinic_admin, get_clinic_admin_cliente_id)
-- =============================================
CREATE OR REPLACE FUNCTION get_user_auth_data(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_is_admin BOOLEAN;
  v_is_clinic_admin BOOLEAN;
  v_cliente_id UUID;
  v_profile_status TEXT;
BEGIN
  -- Buscar role admin
  SELECT EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_is_admin;
  
  -- Buscar role admin_clinica
  SELECT EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = p_user_id AND role = 'admin_clinica'
  ) INTO v_is_clinic_admin;
  
  -- Buscar cliente_id e status do profile
  SELECT cliente_id, status 
  INTO v_cliente_id, v_profile_status
  FROM profiles 
  WHERE user_id = p_user_id;
  
  -- Montar resultado
  v_result := json_build_object(
    'is_admin', COALESCE(v_is_admin, false) AND v_profile_status = 'aprovado',
    'is_clinic_admin', COALESCE(v_is_clinic_admin, false) AND v_profile_status = 'aprovado',
    'cliente_id', v_cliente_id,
    'profile_status', v_profile_status
  );
  
  RETURN v_result;
END;
$$;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION get_user_auth_data(UUID) TO authenticated;

-- =============================================
-- RPC 2: Buscar agendamentos completos com profiles embutidos
-- Substitui paginação manual + busca separada de profiles
-- =============================================
CREATE OR REPLACE FUNCTION get_agendamentos_completos(
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
  status TEXT,
  convenio TEXT,
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
  -- Dados do paciente
  paciente_nome TEXT,
  paciente_data_nascimento DATE,
  paciente_convenio TEXT,
  paciente_telefone TEXT,
  paciente_celular TEXT,
  -- Dados do médico
  medico_nome TEXT,
  medico_especialidade TEXT,
  -- Dados do atendimento
  atendimento_nome TEXT,
  atendimento_tipo TEXT,
  -- Dados do profile criador
  criado_por_profile_nome TEXT,
  criado_por_profile_email TEXT,
  -- Dados do profile alterador
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
    -- Paciente
    p.nome_completo AS paciente_nome,
    p.data_nascimento AS paciente_data_nascimento,
    p.convenio AS paciente_convenio,
    p.telefone AS paciente_telefone,
    p.celular AS paciente_celular,
    -- Médico
    m.nome AS medico_nome,
    m.especialidade AS medico_especialidade,
    -- Atendimento
    at.nome AS atendimento_nome,
    at.tipo AS atendimento_tipo,
    -- Profile criador
    pc.nome AS criado_por_profile_nome,
    pc.email AS criado_por_profile_email,
    -- Profile alterador
    pa.nome AS alterado_por_profile_nome,
    pa.email AS alterado_por_profile_email
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

-- Conceder permissões
GRANT EXECUTE ON FUNCTION get_agendamentos_completos(UUID, INTEGER) TO authenticated;