-- Função para obter estatísticas de todas as clínicas (apenas para admins globais)
CREATE OR REPLACE FUNCTION public.get_all_clinics_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Verificar se o usuário é admin global
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores globais podem acessar estas estatísticas';
  END IF;

  SELECT json_build_object(
    'summary', (
      SELECT json_build_object(
        'total_clinics', (SELECT COUNT(*) FROM public.clientes WHERE ativo = true),
        'total_doctors', (SELECT COUNT(*) FROM public.medicos WHERE ativo = true),
        'total_patients', (SELECT COUNT(*) FROM public.pacientes),
        'total_appointments_today', (
          SELECT COUNT(*) FROM public.agendamentos 
          WHERE data_agendamento = CURRENT_DATE 
          AND status IN ('agendado', 'confirmado')
        ),
        'total_users', (SELECT COUNT(*) FROM public.profiles WHERE status = 'aprovado'),
        'total_future_appointments', (
          SELECT COUNT(*) FROM public.agendamentos 
          WHERE data_agendamento >= CURRENT_DATE 
          AND status IN ('agendado', 'confirmado')
        )
      )
    ),
    'clinics', (
      SELECT json_agg(clinic_stats ORDER BY clinic_stats->>'nome')
      FROM (
        SELECT json_build_object(
          'id', c.id,
          'nome', c.nome,
          'ativo', c.ativo,
          'created_at', c.created_at,
          'doctors_count', (SELECT COUNT(*) FROM public.medicos m WHERE m.cliente_id = c.id AND m.ativo = true),
          'patients_count', (SELECT COUNT(*) FROM public.pacientes p WHERE p.cliente_id = c.id),
          'total_appointments', (SELECT COUNT(*) FROM public.agendamentos a WHERE a.cliente_id = c.id),
          'future_appointments', (
            SELECT COUNT(*) FROM public.agendamentos a 
            WHERE a.cliente_id = c.id 
            AND a.data_agendamento >= CURRENT_DATE 
            AND a.status IN ('agendado', 'confirmado')
          ),
          'today_appointments', (
            SELECT COUNT(*) FROM public.agendamentos a 
            WHERE a.cliente_id = c.id 
            AND a.data_agendamento = CURRENT_DATE 
            AND a.status IN ('agendado', 'confirmado')
          ),
          'users_count', (SELECT COUNT(*) FROM public.profiles p WHERE p.cliente_id = c.id AND p.status = 'aprovado'),
          'last_7_days_appointments', (
            SELECT COALESCE(json_agg(day_data ORDER BY day_data->>'date'), '[]'::json)
            FROM (
              SELECT json_build_object(
                'date', d.date::text,
                'count', COALESCE((
                  SELECT COUNT(*) FROM public.agendamentos a 
                  WHERE a.cliente_id = c.id 
                  AND a.data_agendamento = d.date
                  AND a.status IN ('agendado', 'confirmado', 'cancelado')
                ), 0)
              ) as day_data
              FROM generate_series(
                CURRENT_DATE - interval '6 days', 
                CURRENT_DATE, 
                interval '1 day'
              ) AS d(date)
            ) daily
          )
        ) as clinic_stats
        FROM public.clientes c
        WHERE c.ativo = true
      ) clinics_data
    ),
    'timestamp', now()
  ) INTO v_result;

  RETURN v_result;
END;
$$;