-- Tornar listar_agendamentos_medico_dia multi-tenant de forma explícita
DROP FUNCTION IF EXISTS public.listar_agendamentos_medico_dia(TEXT, DATE);

CREATE OR REPLACE FUNCTION public.listar_agendamentos_medico_dia(
  p_cliente_id UUID,
  p_nome_medico TEXT,
  p_data DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_busca_medico TEXT;
BEGIN
  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'cliente_id é obrigatório';
  END IF;

  v_busca_medico := CASE
    WHEN TRIM(p_nome_medico) ILIKE '%marcelo%' THEN 'Marcelo'
    ELSE TRIM(p_nome_medico)
  END;

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
      WHERE m.nome ILIKE '%' || v_busca_medico || '%'
        AND a.data_agendamento = p_data
        AND a.status IN ('agendado', 'confirmado')
        AND a.excluido_em IS NULL
        AND a.cancelado_em IS NULL
        AND a.cliente_id = p_cliente_id
        AND p.cliente_id = p_cliente_id
        AND m.cliente_id = p_cliente_id
        AND at.cliente_id = p_cliente_id
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_agendamentos_medico_dia(UUID, TEXT, DATE) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.listar_agendamentos_medico_dia(UUID, TEXT, DATE) IS
'Lista agendamentos de um médico em uma data específica com isolamento obrigatório por cliente_id.';
