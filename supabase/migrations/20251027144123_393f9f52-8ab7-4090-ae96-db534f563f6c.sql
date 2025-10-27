-- Recriar função buscar_agendamentos_otimizado para retornar SETOF json
-- Isso remove a limitação de 1000 registros do PostgREST

DROP FUNCTION IF EXISTS buscar_agendamentos_otimizado(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, UUID, TEXT);

CREATE OR REPLACE FUNCTION buscar_agendamentos_otimizado(
    p_data_inicio TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_data_fim TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_medico_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT NULL
)
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
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
        'cancelado_por', a.cancelado_por,
        'cancelado_por_user_id', a.cancelado_por_user_id,
        'cancelado_em', a.cancelado_em,
        'confirmado_por', a.confirmado_por,
        'confirmado_por_user_id', a.confirmado_por_user_id,
        'confirmado_em', a.confirmado_em,
        'excluido_por', a.excluido_por,
        'excluido_por_user_id', a.excluido_por_user_id,
        'excluido_em', a.excluido_em,
        'alterado_por_user_id', a.alterado_por_user_id,
        'paciente_nome', p.nome_completo,
        'paciente_data_nascimento', p.data_nascimento,
        'paciente_convenio', p.convenio,
        'paciente_telefone', p.telefone,
        'paciente_celular', p.celular,
        'medico_nome', m.nome,
        'medico_especialidade', m.especialidade,
        'atendimento_nome', at.nome,
        'atendimento_tipo', at.tipo,
        'profile_nome', prof.nome,
        'profile_email', prof.email,
        'alterado_por_profile_nome', prof_alt.nome,
        'alterado_por_profile_email', prof_alt.email
    )
    FROM agendamentos a
    LEFT JOIN pacientes p ON a.paciente_id = p.id
    LEFT JOIN medicos m ON a.medico_id = m.id
    LEFT JOIN atendimentos at ON a.atendimento_id = at.id
    LEFT JOIN profiles prof ON a.criado_por_user_id = prof.user_id
    LEFT JOIN profiles prof_alt ON a.alterado_por_user_id = prof_alt.user_id
    WHERE a.excluido_em IS NULL
        AND (p_data_inicio IS NULL OR a.data_agendamento >= p_data_inicio::date)
        AND (p_data_fim IS NULL OR a.data_agendamento <= p_data_fim::date)
        AND (p_medico_id IS NULL OR a.medico_id = p_medico_id)
        AND (p_status IS NULL OR a.status = p_status)
    ORDER BY a.data_agendamento DESC, a.hora_agendamento DESC;
END;
$$;