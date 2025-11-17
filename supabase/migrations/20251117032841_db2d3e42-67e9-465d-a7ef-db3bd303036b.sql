-- Modificar função para excluir MAPA da listagem de agendamentos
DROP FUNCTION IF EXISTS public.listar_agendamentos_medico_dia(TEXT, DATE);

CREATE FUNCTION public.listar_agendamentos_medico_dia(
  p_nome_medico TEXT,
  p_data DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'Paciente', p.nome_completo,
          'Telefone', COALESCE(p.celular, p.telefone, 'Sem telefone'),
          'Horário', (a.data_agendamento::text || ' ' || a.hora_agendamento::text)::timestamp,
          'Tipo de atendimento', at.nome,
          'Médico', m.nome
        ) ORDER BY a.hora_agendamento
      )
      FROM public.agendamentos a
      INNER JOIN public.pacientes p ON a.paciente_id = p.id
      INNER JOIN public.medicos m ON a.medico_id = m.id
      INNER JOIN public.atendimentos at ON a.atendimento_id = at.id
      WHERE 
        m.nome ILIKE '%' || TRIM(p_nome_medico) || '%'
        AND a.data_agendamento = p_data
        AND a.status IN ('agendado', 'confirmado')
        AND a.excluido_em IS NULL
        AND a.cancelado_em IS NULL
        AND at.nome NOT ILIKE '%MAPA%'
    ),
    '[]'::jsonb
  );
END;
$$;