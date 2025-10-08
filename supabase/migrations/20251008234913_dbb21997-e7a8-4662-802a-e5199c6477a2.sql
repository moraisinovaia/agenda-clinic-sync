-- Atualizar buscar_agendamentos_otimizado com todos os campos necessários

DROP FUNCTION IF EXISTS public.buscar_agendamentos_otimizado();

CREATE FUNCTION public.buscar_agendamentos_otimizado()
RETURNS TABLE(
  id uuid,
  paciente_id uuid,
  paciente_nome character varying,
  paciente_convenio character varying,
  paciente_telefone character varying,
  paciente_celular character varying,
  paciente_data_nascimento date,
  medico_id uuid,
  medico_nome character varying,
  medico_especialidade character varying,
  atendimento_id uuid,
  atendimento_nome character varying,
  atendimento_tipo character varying,
  data_agendamento date,
  hora_agendamento time,
  status character varying,
  observacoes text,
  convenio character varying,
  criado_por text,
  criado_por_user_id uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  confirmado_por text,
  confirmado_em timestamp with time zone,
  confirmado_por_user_id uuid,
  cancelado_em timestamp with time zone,
  cancelado_por text,
  cancelado_por_user_id uuid,
  alterado_por_user_id uuid,
  excluido_em timestamp with time zone,
  excluido_por text,
  excluido_por_user_id uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    a.id,
    a.paciente_id,
    p.nome_completo as paciente_nome,
    p.convenio as paciente_convenio,
    p.telefone as paciente_telefone,
    p.celular as paciente_celular,
    p.data_nascimento as paciente_data_nascimento,
    a.medico_id,
    m.nome as medico_nome,
    m.especialidade as medico_especialidade,
    a.atendimento_id,
    at.nome as atendimento_nome,
    at.tipo as atendimento_tipo,
    a.data_agendamento,
    a.hora_agendamento,
    a.status,
    a.observacoes,
    a.convenio,
    a.criado_por,
    a.criado_por_user_id,
    a.created_at,
    a.updated_at,
    a.confirmado_por,
    a.confirmado_em,
    a.confirmado_por_user_id,
    a.cancelado_em,
    a.cancelado_por,
    a.cancelado_por_user_id,
    a.alterado_por_user_id,
    a.excluido_em,
    a.excluido_por,
    a.excluido_por_user_id
  FROM public.agendamentos a
  LEFT JOIN public.pacientes p ON a.paciente_id = p.id
  LEFT JOIN public.medicos m ON a.medico_id = m.id
  LEFT JOIN public.atendimentos at ON a.atendimento_id = at.id
  WHERE a.cliente_id = get_user_cliente_id()
    AND (a.excluido_em IS NULL OR a.status != 'cancelado')
  ORDER BY a.data_agendamento DESC, a.hora_agendamento DESC;
$$;