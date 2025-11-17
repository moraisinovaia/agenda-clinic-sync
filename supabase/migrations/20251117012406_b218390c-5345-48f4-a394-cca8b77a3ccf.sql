-- Drop e recriar função para excluir médicos MAPA da busca
DROP FUNCTION IF EXISTS public.listar_agendamentos_medico_dia(TEXT, DATE);

CREATE FUNCTION public.listar_agendamentos_medico_dia(
  p_nome_medico TEXT,
  p_data DATE
)
RETURNS TABLE(
  agendamento_id UUID,
  nome_paciente TEXT,
  telefone_contato TEXT,
  hora_agendamento TIME,
  tipo_atendimento TEXT,
  periodo TEXT,
  observacoes TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id AS agendamento_id,
    p.nome_completo AS nome_paciente,
    COALESCE(p.celular, p.telefone, 'Sem telefone') AS telefone_contato,
    a.hora_agendamento,
    at.nome AS tipo_atendimento,
    CASE 
      WHEN a.hora_agendamento < '12:00'::TIME THEN 'manhã'
      WHEN a.hora_agendamento >= '12:00'::TIME AND a.hora_agendamento < '18:00'::TIME THEN 'tarde'
      ELSE 'noite'
    END AS periodo,
    COALESCE(a.observacoes, '') AS observacoes
  FROM public.agendamentos a
  INNER JOIN public.pacientes p ON a.paciente_id = p.id
  INNER JOIN public.medicos m ON a.medico_id = m.id
  INNER JOIN public.atendimentos at ON a.atendimento_id = at.id
  WHERE 
    m.nome ILIKE '%' || TRIM(p_nome_medico) || '%'
    AND m.nome NOT ILIKE 'MAPA -%'
    AND a.data_agendamento = p_data
    AND a.status = 'agendado'
    AND a.excluido_em IS NULL
    AND a.cancelado_em IS NULL
  ORDER BY a.hora_agendamento;
END;
$$;