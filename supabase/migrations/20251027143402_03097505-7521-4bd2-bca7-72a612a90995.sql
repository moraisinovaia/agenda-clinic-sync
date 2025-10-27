-- Remover função antiga e recriar SEM LIMITES
DROP FUNCTION IF EXISTS buscar_agendamentos_otimizado(date, date, uuid, text);

CREATE OR REPLACE FUNCTION buscar_agendamentos_otimizado(
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL,
  p_medico_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  paciente_id uuid,
  medico_id uuid,
  atendimento_id uuid,
  data_agendamento date,
  hora_agendamento time,
  status varchar,
  convenio varchar,
  observacoes text,
  criado_por text,
  criado_por_user_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  cancelado_por text,
  cancelado_por_user_id uuid,
  cancelado_em timestamptz,
  confirmado_por text,
  confirmado_por_user_id uuid,
  confirmado_em timestamptz,
  excluido_por text,
  excluido_por_user_id uuid,
  excluido_em timestamptz,
  alterado_por_user_id uuid,
  cliente_id uuid,
  paciente_nome varchar,
  paciente_data_nascimento date,
  paciente_convenio varchar,
  paciente_telefone varchar,
  paciente_celular varchar,
  medico_nome varchar,
  medico_especialidade varchar,
  atendimento_nome varchar,
  atendimento_tipo varchar,
  profile_nome text,
  profile_email text,
  alterado_por_profile_nome text,
  alterado_por_profile_email text
)
LANGUAGE plpgsql
STABLE
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
    a.created_at,
    a.updated_at,
    a.cancelado_por,
    a.cancelado_por_user_id,
    a.cancelado_em,
    a.confirmado_por,
    a.confirmado_por_user_id,
    a.confirmado_em,
    a.excluido_por,
    a.excluido_por_user_id,
    a.excluido_em,
    a.alterado_por_user_id,
    a.cliente_id,
    p.nome_completo as paciente_nome,
    p.data_nascimento as paciente_data_nascimento,
    p.convenio as paciente_convenio,
    p.telefone as paciente_telefone,
    p.celular as paciente_celular,
    m.nome as medico_nome,
    m.especialidade as medico_especialidade,
    at.nome as atendimento_nome,
    at.tipo as atendimento_tipo,
    prof.nome as profile_nome,
    prof.email as profile_email,
    prof_alt.nome as alterado_por_profile_nome,
    prof_alt.email as alterado_por_profile_email
  FROM agendamentos a
  INNER JOIN pacientes p ON p.id = a.paciente_id
  INNER JOIN medicos m ON m.id = a.medico_id
  INNER JOIN atendimentos at ON at.id = a.atendimento_id
  LEFT JOIN profiles prof ON prof.user_id = a.criado_por_user_id
  LEFT JOIN profiles prof_alt ON prof_alt.user_id = a.alterado_por_user_id
  WHERE 
    a.excluido_em IS NULL
    AND (p_data_inicio IS NULL OR a.data_agendamento >= p_data_inicio)
    AND (p_data_fim IS NULL OR a.data_agendamento <= p_data_fim)
    AND (p_medico_id IS NULL OR a.medico_id = p_medico_id)
    AND (p_status IS NULL OR a.status = p_status)
  ORDER BY a.data_agendamento ASC, a.hora_agendamento ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION buscar_agendamentos_otimizado TO authenticated;
GRANT EXECUTE ON FUNCTION buscar_agendamentos_otimizado TO anon;