-- Corrigir incompatibilidade de tipos na RPC buscar_agendamentos_otimizado
DROP FUNCTION IF EXISTS buscar_agendamentos_otimizado();

CREATE OR REPLACE FUNCTION buscar_agendamentos_otimizado()
RETURNS TABLE (
  id UUID,
  paciente_id UUID,
  medico_id UUID,
  atendimento_id UUID,
  data_agendamento DATE,
  hora_agendamento TIME,
  status VARCHAR, -- Mudança aqui: VARCHAR em vez de TEXT
  observacoes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  criado_por TEXT,
  criado_por_user_id UUID,
  
  -- Dados do paciente desnormalizados
  paciente_nome TEXT,
  paciente_convenio VARCHAR, -- Mudança aqui: VARCHAR em vez de TEXT
  paciente_celular VARCHAR, -- Mudança aqui: VARCHAR em vez de TEXT
  paciente_telefone VARCHAR, -- Mudança aqui: VARCHAR em vez de TEXT
  paciente_data_nascimento DATE,
  
  -- Dados do médico desnormalizados
  medico_nome VARCHAR, -- Mudança aqui: VARCHAR em vez de TEXT
  medico_especialidade VARCHAR, -- Mudança aqui: VARCHAR em vez de TEXT
  
  -- Dados do atendimento desnormalizados
  atendimento_nome VARCHAR, -- Mudança aqui: VARCHAR em vez de TEXT
  atendimento_tipo VARCHAR -- Mudança aqui: VARCHAR em vez de TEXT
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
    a.status::VARCHAR,
    a.observacoes,
    a.created_at,
    a.updated_at,
    a.criado_por,
    a.criado_por_user_id,
    
    -- Dados do paciente
    p.nome_completo as paciente_nome,
    p.convenio::VARCHAR as paciente_convenio,
    p.celular::VARCHAR as paciente_celular,
    p.telefone::VARCHAR as paciente_telefone,
    p.data_nascimento as paciente_data_nascimento,
    
    -- Dados do médico
    m.nome::VARCHAR as medico_nome,
    m.especialidade::VARCHAR as medico_especialidade,
    
    -- Dados do atendimento
    at.nome::VARCHAR as atendimento_nome,
    at.tipo::VARCHAR as atendimento_tipo
  FROM agendamentos a
  LEFT JOIN pacientes p ON a.paciente_id = p.id
  LEFT JOIN medicos m ON a.medico_id = m.id
  LEFT JOIN atendimentos at ON a.atendimento_id = at.id
  ORDER BY a.data_agendamento DESC, a.hora_agendamento DESC;
END;
$$;