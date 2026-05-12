-- Cria overload `listar_agendamentos_medico_dia(p_cliente_id, p_nome_medico, p_data)`
-- com filtro multi-tenant.
--
-- A versão existente (sem p_cliente_id) retorna agendamentos de QUALQUER cliente
-- com médico de nome correspondente — vazamento de dados entre tenants em prod.
-- O handler /list-appointments chama com cliente_id, então cai em "function not
-- found". Esta overload resolve ambos problemas.

CREATE OR REPLACE FUNCTION public.listar_agendamentos_medico_dia(
  p_cliente_id uuid,
  p_nome_medico text,
  p_data date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_busca_medico TEXT;
BEGIN
  -- Marcelo: simplifica para pegar todos os Marcelos do cliente (ex: virtuais MAPA/TE).
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
          'Médico', m.nome,
          'agendamento_id', a.id,
          'status', a.status
        ) ORDER BY a.hora_agendamento
      )
      FROM public.agendamentos a
      INNER JOIN public.pacientes   p  ON a.paciente_id    = p.id
      INNER JOIN public.medicos     m  ON a.medico_id      = m.id
      INNER JOIN public.atendimentos at ON a.atendimento_id = at.id
      WHERE m.nome ILIKE '%' || v_busca_medico || '%'
        AND a.data_agendamento = p_data
        AND a.cliente_id       = p_cliente_id  -- multi-tenant
        AND m.cliente_id       = p_cliente_id  -- defesa em profundidade
        AND a.status IN ('agendado', 'confirmado')
        AND a.excluido_em IS NULL
        AND a.cancelado_em IS NULL
        AND at.nome NOT ILIKE '%MAPA%'
    ),
    '[]'::jsonb
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.listar_agendamentos_medico_dia(uuid, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_agendamentos_medico_dia(uuid, text, date) TO authenticated, service_role, anon;
