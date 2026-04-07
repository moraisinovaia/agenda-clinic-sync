ALTER TABLE public.configuracoes_clinica
  ADD COLUMN IF NOT EXISTS agendamento_api_base_url text,
  ADD COLUMN IF NOT EXISTS agendamento_allowed_services jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.configuracoes_clinica.agendamento_api_base_url IS
'Base URL opcional da API de agendamento usada pelo canal n8n desta clínica/número. Quando nulo, o fluxo usa a llm-agent-api padrão.';

COMMENT ON COLUMN public.configuracoes_clinica.agendamento_allowed_services IS
'Lista opcional de serviços permitidos para o canal n8n desta clínica/número. Ex.: [\"Consulta Cardiológica\", \"Teste Ergométrico\"].';

CREATE OR REPLACE FUNCTION public.get_clinic_runtime_context(p_cliente_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result json;
  v_clinica record;
  v_caller_role text;
  v_jwt_cliente_id uuid;
BEGIN
  -- ============ VALIDAÇÃO DE TENANT ============
  v_caller_role := current_setting('role', true);

  IF v_caller_role IS DISTINCT FROM 'service_role' THEN
    BEGIN
      v_jwt_cliente_id := (
        (current_setting('request.jwt.claims', true))::json ->> 'cliente_id'
      )::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_jwt_cliente_id := NULL;
    END;

    IF v_jwt_cliente_id IS NULL OR v_jwt_cliente_id != p_cliente_id THEN
      RETURN json_build_object(
        'error', 'Acesso negado: você não tem permissão para acessar dados desta clínica.'
      );
    END IF;
  END IF;
  -- ============ FIM DA VALIDAÇÃO ============

  SELECT
    nome_clinica,
    telefone_publico,
    agendamento_api_base_url,
    agendamento_allowed_services
  INTO v_clinica
  FROM public.configuracoes_clinica
  WHERE id = p_cliente_id;

  IF v_clinica IS NULL THEN
    RETURN json_build_object('error', 'Clínica não encontrada');
  END IF;

  SELECT json_build_object(
    'clinica', json_build_object(
      'nome', v_clinica.nome_clinica,
      'telefone', v_clinica.telefone_publico
    ),
    'agendamento', json_build_object(
      'api_base_url', v_clinica.agendamento_api_base_url,
      'allowed_services', COALESCE(v_clinica.agendamento_allowed_services, '[]'::jsonb)
    ),
    'medicos', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', m.id,
          'nome', m.nome,
          'especialidade', m.especialidade,
          'crm', m.crm
        ) ORDER BY m.nome
      ), '[]'::json)
      FROM public.medicos m
      WHERE m.cliente_id = p_cliente_id AND m.ativo = true
    ),
    'procedimentos', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'nome', pc.nome,
          'aliases', pc.aliases,
          'tipo', pc.tipo,
          'disponivel', pc.disponivel,
          'observacao', pc.observacao,
          'medico_nome', m.nome
        ) ORDER BY pc.nome
      ), '[]'::json)
      FROM public.procedimentos_clinica pc
      LEFT JOIN public.medicos m ON m.id = pc.medico_id
      WHERE pc.cliente_id = p_cliente_id AND pc.disponivel = true
    ),
    'convenios_por_medico', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'medico_nome', m.nome,
          'medico_id', m.id,
          'convenios_aceitos', (
            SELECT COALESCE(array_agg(cm.convenio_nome ORDER BY cm.convenio_nome), '{}')
            FROM public.convenios_medico cm
            WHERE cm.medico_id = m.id
              AND cm.cliente_id = p_cliente_id
              AND cm.status = 'atende'
          )
        ) ORDER BY m.nome
      ), '[]'::json)
      FROM public.medicos m
      WHERE m.cliente_id = p_cliente_id AND m.ativo = true
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
