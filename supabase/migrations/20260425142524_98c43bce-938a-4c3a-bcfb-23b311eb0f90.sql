DROP FUNCTION IF EXISTS public.criar_agendamento_atomico(
  p_nome_completo text,
  p_data_nascimento text,
  p_convenio text,
  p_telefone text,
  p_celular text,
  p_medico_id uuid,
  p_atendimento_id uuid,
  p_data_agendamento text,
  p_hora_agendamento text,
  p_observacoes text,
  p_criado_por text,
  p_criado_por_user_id uuid,
  p_agendamento_id_edicao uuid,
  p_force_conflict boolean
);