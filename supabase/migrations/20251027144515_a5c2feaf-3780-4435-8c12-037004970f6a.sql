-- Drop ALL existing versions of the function to eliminate overload conflicts
DROP FUNCTION IF EXISTS buscar_agendamentos_otimizado(date, date, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS buscar_agendamentos_otimizado(timestamp with time zone, timestamp with time zone, uuid, text) CASCADE;

-- Create a single canonical version that returns SETOF json (bypasses PostgREST 1000-row limit)
CREATE OR REPLACE FUNCTION buscar_agendamentos_otimizado(
    p_data_inicio timestamp with time zone DEFAULT NULL,
    p_data_fim timestamp with time zone DEFAULT NULL,
    p_medico_id uuid DEFAULT NULL,
    p_status text DEFAULT NULL
)
RETURNS SETOF json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT json_build_object(
        'id', a.id,
        'paciente_id', a.paciente_id,
        'medico_id', a.medico_id,
        'atendimento_id', a.atendimento_id,
        'data_agendamento', a.data_agendamento,
        'hora_agendamento', a.hora_agendamento,
        'status', a.status,
        'convenio', a.convenio,
        'observacoes', a.observacoes,
        'criado_por', a.criado_por,
        'criado_por_user_id', a.criado_por_user_id,
        'created_at', a.created_at,
        'updated_at', a.updated_at,
        'paciente_nome', p.nome_completo,
        'paciente_data_nascimento', p.data_nascimento,
        'paciente_convenio', p.convenio,
        'paciente_telefone', p.telefone,
        'paciente_celular', p.celular,
        'medico_nome', m.nome,
        'medico_especialidade', m.especialidade,
        'atendimento_nome', at.nome,
        'atendimento_tipo', at.tipo,
        'cancelado_por', a.cancelado_por,
        'cancelado_por_user_id', a.cancelado_por_user_id,
        'cancelado_em', a.cancelado_em,
        'confirmado_por', a.confirmado_por,
        'confirmado_por_user_id', a.confirmado_por_user_id,
        'confirmado_em', a.confirmado_em,
        'alterado_por_user_id', a.alterado_por_user_id,
        'excluido_por', a.excluido_por,
        'excluido_por_user_id', a.excluido_por_user_id,
        'excluido_em', a.excluido_em,
        'profile_nome', prof.nome,
        'profile_email', prof.email,
        'alterado_por_profile_nome', prof_alt.nome,
        'alterado_por_profile_email', prof_alt.email
    )
    FROM agendamentos a
    INNER JOIN pacientes p ON p.id = a.paciente_id
    INNER JOIN medicos m ON m.id = a.medico_id
    INNER JOIN atendimentos at ON at.id = a.atendimento_id
    LEFT JOIN profiles prof ON prof.user_id = a.criado_por_user_id
    LEFT JOIN profiles prof_alt ON prof_alt.user_id = a.alterado_por_user_id
    WHERE 
        a.excluido_em IS NULL
        AND (p_data_inicio IS NULL OR a.data_agendamento >= p_data_inicio::date)
        AND (p_data_fim IS NULL OR a.data_agendamento <= p_data_fim::date)
        AND (p_medico_id IS NULL OR a.medico_id = p_medico_id)
        AND (p_status IS NULL OR a.status = p_status)
    ORDER BY a.data_agendamento ASC, a.hora_agendamento ASC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION buscar_agendamentos_otimizado(timestamp with time zone, timestamp with time zone, uuid, text) TO authenticated;