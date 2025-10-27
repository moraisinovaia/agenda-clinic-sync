-- Recriar função buscar_agendamentos_otimizado para retornar TODOS os agendamentos não excluídos
CREATE OR REPLACE FUNCTION buscar_agendamentos_otimizado(
  p_data_inicio DATE DEFAULT NULL,
  p_data_fim DATE DEFAULT NULL,
  p_medico_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
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
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  paciente_nome VARCHAR,
  paciente_data_nascimento DATE,
  paciente_convenio VARCHAR,
  paciente_telefone VARCHAR,
  paciente_celular VARCHAR,
  medico_nome VARCHAR,
  medico_especialidade VARCHAR,
  atendimento_nome VARCHAR,
  atendimento_tipo VARCHAR,
  cancelado_por TEXT,
  cancelado_por_user_id UUID,
  cancelado_em TIMESTAMPTZ,
  confirmado_por TEXT,
  confirmado_por_user_id UUID,
  confirmado_em TIMESTAMPTZ,
  alterado_por_user_id UUID,
  excluido_por TEXT,
  excluido_por_user_id UUID,
  excluido_em TIMESTAMPTZ,
  profile_nome TEXT,
  profile_email TEXT,
  alterado_por_profile_nome TEXT,
  alterado_por_profile_email TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
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
    a.created_at,
    a.updated_at,
    p.nome_completo AS paciente_nome,
    p.data_nascimento AS paciente_data_nascimento,
    p.convenio AS paciente_convenio,
    p.telefone AS paciente_telefone,
    p.celular AS paciente_celular,
    m.nome AS medico_nome,
    m.especialidade AS medico_especialidade,
    at.nome AS atendimento_nome,
    at.tipo AS atendimento_tipo,
    a.cancelado_por,
    a.cancelado_por_user_id,
    a.cancelado_em,
    a.confirmado_por,
    a.confirmado_por_user_id,
    a.confirmado_em,
    a.alterado_por_user_id,
    a.excluido_por,
    a.excluido_por_user_id,
    a.excluido_em,
    prof.nome AS profile_nome,
    prof.email AS profile_email,
    alt_prof.nome AS alterado_por_profile_nome,
    alt_prof.email AS alterado_por_profile_email
  FROM agendamentos a
  LEFT JOIN pacientes p ON a.paciente_id = p.id
  LEFT JOIN medicos m ON a.medico_id = m.id
  LEFT JOIN atendimentos at ON a.atendimento_id = at.id
  LEFT JOIN profiles prof ON a.criado_por_user_id = prof.user_id
  LEFT JOIN profiles alt_prof ON a.alterado_por_user_id = alt_prof.user_id
  WHERE 
    -- FILTRO PRINCIPAL: apenas agendamentos NÃO excluídos
    a.excluido_em IS NULL
    -- Filtros opcionais
    AND (p_data_inicio IS NULL OR a.data_agendamento >= p_data_inicio)
    AND (p_data_fim IS NULL OR a.data_agendamento <= p_data_fim)
    AND (p_medico_id IS NULL OR a.medico_id = p_medico_id)
    AND (p_status IS NULL OR a.status = p_status)
  ORDER BY 
    a.data_agendamento ASC,
    a.hora_agendamento ASC;
END;
$$;