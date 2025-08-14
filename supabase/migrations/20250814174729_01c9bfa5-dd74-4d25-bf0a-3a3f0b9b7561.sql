-- Corrigir definitivamente a incompatibilidade de tipos na RPC buscar_agendamentos_otimizado
DROP FUNCTION IF EXISTS buscar_agendamentos_otimizado();

CREATE OR REPLACE FUNCTION buscar_agendamentos_otimizado()
RETURNS TABLE (
  id UUID,
  paciente_id UUID,
  medico_id UUID,
  atendimento_id UUID,
  data_agendamento DATE,
  hora_agendamento TIME,
  status TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  criado_por TEXT,
  criado_por_user_id UUID,
  
  -- Dados do paciente desnormalizados - TODOS TEXT
  paciente_nome TEXT,
  paciente_convenio TEXT,
  paciente_celular TEXT,
  paciente_telefone TEXT,
  paciente_data_nascimento DATE,
  
  -- Dados do médico desnormalizados - TODOS TEXT
  medico_nome TEXT,
  medico_especialidade TEXT,
  
  -- Dados do atendimento desnormalizados - TODOS TEXT
  atendimento_nome TEXT,
  atendimento_tipo TEXT
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
    a.observacoes,
    a.created_at,
    a.updated_at,
    a.criado_por,
    a.criado_por_user_id,
    
    -- Dados do paciente - EXPLICITAMENTE CONVERTIDOS PARA TEXT
    p.nome_completo::TEXT as paciente_nome,
    p.convenio::TEXT as paciente_convenio,
    p.celular::TEXT as paciente_celular,
    p.telefone::TEXT as paciente_telefone,
    p.data_nascimento as paciente_data_nascimento,
    
    -- Dados do médico - EXPLICITAMENTE CONVERTIDOS PARA TEXT
    m.nome::TEXT as medico_nome,
    m.especialidade::TEXT as medico_especialidade,
    
    -- Dados do atendimento - EXPLICITAMENTE CONVERTIDOS PARA TEXT
    at.nome::TEXT as atendimento_nome,
    at.tipo::TEXT as atendimento_tipo
  FROM agendamentos a
  LEFT JOIN pacientes p ON a.paciente_id = p.id
  LEFT JOIN medicos m ON a.medico_id = m.id
  LEFT JOIN atendimentos at ON a.atendimento_id = at.id
  ORDER BY a.data_agendamento DESC, a.hora_agendamento DESC;
END;
$$;