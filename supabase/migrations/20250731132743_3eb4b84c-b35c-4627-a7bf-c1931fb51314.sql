-- 1. Corrigir buscar_agendamentos_otimizado para incluir data_nascimento e telefone
CREATE OR REPLACE FUNCTION public.buscar_agendamentos_otimizado()
 RETURNS TABLE(id uuid, paciente_id uuid, medico_id uuid, atendimento_id uuid, data_agendamento date, hora_agendamento time without time zone, status text, observacoes text, created_at timestamp with time zone, updated_at timestamp with time zone, criado_por text, criado_por_user_id uuid, paciente_nome text, paciente_convenio text, paciente_celular text, paciente_data_nascimento date, paciente_telefone text, medico_nome text, medico_especialidade text, atendimento_nome text, atendimento_tipo text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    p.nome_completo as paciente_nome,
    p.convenio as paciente_convenio,
    p.celular as paciente_celular,
    p.data_nascimento as paciente_data_nascimento,
    p.telefone as paciente_telefone,
    m.nome as medico_nome,
    m.especialidade as medico_especialidade,
    at.nome as atendimento_nome,
    at.tipo as atendimento_tipo
  FROM public.agendamentos a
  JOIN public.pacientes p ON a.paciente_id = p.id
  JOIN public.medicos m ON a.medico_id = m.id
  JOIN public.atendimentos at ON a.atendimento_id = at.id
  WHERE a.status != 'cancelado' -- Não mostrar agendamentos cancelados
  ORDER BY a.data_agendamento ASC, a.hora_agendamento ASC;
$function$;