-- Função para listar agendamentos de um médico em um dia específico
-- Retorna apenas agendamentos com status 'agendado', não cancelados/excluídos
-- Período: manhã (< 12:00) ou tarde (>= 12:00)

CREATE OR REPLACE FUNCTION public.listar_agendamentos_medico_dia(
  p_nome_medico TEXT,
  p_data DATE
)
RETURNS TABLE (
  agendamento_id UUID,
  nome_paciente TEXT,
  telefone_contato TEXT,
  tipo_atendimento TEXT,
  periodo TEXT,
  hora_agendamento TIME,
  observacoes TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as agendamento_id,
    p.nome_completo as nome_paciente,
    COALESCE(p.celular, p.telefone) as telefone_contato,
    at.nome as tipo_atendimento,
    CASE 
      WHEN a.hora_agendamento < '12:00:00' THEN 'manhã'
      ELSE 'tarde'
    END as periodo,
    a.hora_agendamento,
    a.observacoes
  FROM public.agendamentos a
  INNER JOIN public.pacientes p ON a.paciente_id = p.id
  INNER JOIN public.medicos m ON a.medico_id = m.id
  INNER JOIN public.atendimentos at ON a.atendimento_id = at.id
  WHERE 
    LOWER(TRIM(m.nome)) = LOWER(TRIM(p_nome_medico))
    AND a.data_agendamento = p_data
    AND a.status = 'agendado'
    AND a.excluido_em IS NULL
    AND a.cancelado_em IS NULL
  ORDER BY a.hora_agendamento ASC;
END;
$$;

-- Comentário da função
COMMENT ON FUNCTION public.listar_agendamentos_medico_dia(TEXT, DATE) IS 
'Lista todos os agendamentos de um médico em uma data específica. 
Filtra apenas agendamentos com status agendado, não cancelados/excluídos.
Retorna paciente, telefone, tipo de atendimento e período (manhã/tarde).
Usado por workflows N8N para relatórios diários.';