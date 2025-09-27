-- Atualizar função buscar_agendamentos_otimizado para excluir agendamentos excluídos por padrão
CREATE OR REPLACE FUNCTION public.buscar_agendamentos_otimizado()
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
  profile_role text,
  alterado_por_profile_nome text,
  alterado_por_profile_email text,
  alterado_por_profile_role text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
BEGIN
  -- Obter cliente_id do usuário atual
  SELECT get_user_cliente_id() INTO v_cliente_id;
  
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
    prof.nome as profile_nome,
    prof.email as profile_email,
    prof.role as profile_role,
    alt_prof.nome as alterado_por_profile_nome,
    alt_prof.email as alterado_por_profile_email,
    alt_prof.role as alterado_por_profile_role
  FROM public.agendamentos a
  LEFT JOIN public.pacientes p ON a.paciente_id = p.id
  LEFT JOIN public.medicos m ON a.medico_id = m.id  
  LEFT JOIN public.atendimentos at ON a.atendimento_id = at.id
  LEFT JOIN public.profiles prof ON a.criado_por_user_id = prof.user_id
  LEFT JOIN public.profiles alt_prof ON a.alterado_por_user_id = alt_prof.user_id
  WHERE a.cliente_id = v_cliente_id
    AND a.status != 'excluido'  -- Excluir agendamentos excluídos por padrão
  ORDER BY a.data_agendamento DESC, a.hora_agendamento DESC;
END;
$$;