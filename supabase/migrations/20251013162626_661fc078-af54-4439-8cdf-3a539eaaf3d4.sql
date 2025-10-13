-- Recriar função buscar_agendamentos_otimizado com informações de perfil
CREATE OR REPLACE FUNCTION public.buscar_agendamentos_otimizado(
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
  paciente_nome varchar,
  paciente_data_nascimento date,
  paciente_convenio varchar,
  paciente_telefone varchar,
  paciente_celular varchar,
  medico_nome varchar,
  medico_especialidade varchar,
  atendimento_nome varchar,
  atendimento_tipo varchar,
  cancelado_por text,
  cancelado_por_user_id uuid,
  cancelado_em timestamptz,
  confirmado_por text,
  confirmado_por_user_id uuid,
  confirmado_em timestamptz,
  alterado_por_user_id uuid,
  excluido_por text,
  excluido_por_user_id uuid,
  excluido_em timestamptz,
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
DECLARE
  v_cliente_id uuid;
BEGIN
  v_cliente_id := get_user_cliente_id();
  
  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem cliente_id definido';
  END IF;

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
    p.nome_completo as paciente_nome,
    p.data_nascimento as paciente_data_nascimento,
    p.convenio as paciente_convenio,
    p.telefone as paciente_telefone,
    p.celular as paciente_celular,
    m.nome as medico_nome,
    m.especialidade as medico_especialidade,
    at.nome as atendimento_nome,
    at.tipo as atendimento_tipo,
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
    prof_criador.nome as profile_nome,
    prof_criador.email as profile_email,
    prof_alterador.nome as alterado_por_profile_nome,
    prof_alterador.email as alterado_por_profile_email
  FROM public.agendamentos a
  INNER JOIN public.pacientes p ON a.paciente_id = p.id
  INNER JOIN public.medicos m ON a.medico_id = m.id
  INNER JOIN public.atendimentos at ON a.atendimento_id = at.id
  LEFT JOIN public.profiles prof_criador ON a.criado_por_user_id = prof_criador.user_id
  LEFT JOIN public.profiles prof_alterador ON a.alterado_por_user_id = prof_alterador.user_id
  WHERE a.cliente_id = v_cliente_id
    AND (p_data_inicio IS NULL OR a.data_agendamento >= p_data_inicio)
    AND (p_data_fim IS NULL OR a.data_agendamento <= p_data_fim)
    AND (p_medico_id IS NULL OR a.medico_id = p_medico_id)
    AND (p_status IS NULL OR a.status = p_status)
  ORDER BY a.data_agendamento DESC, a.hora_agendamento DESC;
END;
$$;