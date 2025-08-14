-- Drop and recreate the buscar_agendamentos_otimizado function with correct types
DROP FUNCTION IF EXISTS public.buscar_agendamentos_otimizado();

CREATE OR REPLACE FUNCTION public.buscar_agendamentos_otimizado()
RETURNS TABLE(
  id UUID,
  paciente_id UUID,
  medico_id UUID,
  atendimento_id UUID,
  data_agendamento DATE,
  hora_agendamento TIME,
  status CHARACTER VARYING,
  convenio CHARACTER VARYING,
  observacoes TEXT,
  criado_por TEXT,
  criado_por_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  paciente_nome CHARACTER VARYING,
  paciente_data_nascimento DATE,
  paciente_convenio CHARACTER VARYING,
  paciente_telefone CHARACTER VARYING,
  paciente_celular CHARACTER VARYING,
  medico_nome CHARACTER VARYING,
  medico_especialidade CHARACTER VARYING,
  atendimento_nome CHARACTER VARYING,
  atendimento_tipo CHARACTER VARYING,
  cancelado_por TEXT,
  cancelado_por_user_id UUID,
  cancelado_em TIMESTAMP WITH TIME ZONE,
  confirmado_por TEXT,
  confirmado_por_user_id UUID,
  confirmado_em TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    a.confirmado_em
  FROM public.agendamentos a
  LEFT JOIN public.pacientes p ON a.paciente_id = p.id
  LEFT JOIN public.medicos m ON a.medico_id = m.id
  LEFT JOIN public.atendimentos at ON a.atendimento_id = at.id
  ORDER BY a.data_agendamento DESC, a.hora_agendamento DESC;
END;
$$;