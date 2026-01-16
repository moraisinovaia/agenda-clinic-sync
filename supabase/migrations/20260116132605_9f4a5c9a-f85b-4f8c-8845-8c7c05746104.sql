-- Recriar função criar_agendamento_atomico com suporte a cliente_id
DROP FUNCTION IF EXISTS criar_agendamento_atomico(text, text, text, text, text, uuid, uuid, date, time, text, text, uuid);

CREATE OR REPLACE FUNCTION criar_agendamento_atomico(
  p_nome_completo text,
  p_data_nascimento text,
  p_convenio text,
  p_telefone text,
  p_celular text,
  p_medico_id uuid,
  p_atendimento_id uuid,
  p_data_agendamento date,
  p_hora_agendamento time,
  p_observacoes text,
  p_criado_por text,
  p_criado_por_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id uuid;
  v_agendamento_id uuid;
  v_existing_appointment_id uuid;
  v_existing_status text;
  v_existing_paciente_nome text;
  v_is_editing boolean := false;
  v_criado_por_usado text;
  v_warnings text[] := '{}';
  v_cliente_id uuid;
BEGIN
  -- Validações básicas
  IF p_nome_completo IS NULL OR TRIM(p_nome_completo) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Nome do paciente é obrigatório',
      'error_type', 'validation'
    );
  END IF;

  IF p_celular IS NULL OR TRIM(p_celular) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Celular é obrigatório',
      'error_type', 'validation'
    );
  END IF;

  -- CORREÇÃO: Buscar cliente_id do médico
  SELECT cliente_id INTO v_cliente_id
  FROM medicos
  WHERE id = p_medico_id;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Médico não encontrado ou sem clínica associada',
      'error_type', 'validation'
    );
  END IF;

  -- Verificar conflito de horário (outro paciente no mesmo horário)
  SELECT agendamentos.id, agendamentos.status, p.nome_completo
  INTO v_existing_appointment_id, v_existing_status, v_existing_paciente_nome
  FROM agendamentos
  JOIN pacientes p ON p.id = agendamentos.paciente_id
  WHERE agendamentos.medico_id = p_medico_id
    AND agendamentos.data_agendamento = p_data_agendamento
    AND agendamentos.hora_agendamento = p_hora_agendamento
    AND agendamentos.status NOT IN ('cancelado', 'cancelado_bloqueio')
  LIMIT 1;

  IF v_existing_appointment_id IS NOT NULL THEN
    -- Verificar se é o mesmo paciente (edição)
    IF LOWER(TRIM(v_existing_paciente_nome)) = LOWER(TRIM(p_nome_completo)) THEN
      v_is_editing := true;
      v_agendamento_id := v_existing_appointment_id;
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Conflito: Horário já ocupado por %s', v_existing_paciente_nome),
        'error_type', 'conflict',
        'conflict_detected', true,
        'conflict_details', jsonb_build_object(
          'existing_patient', v_existing_paciente_nome,
          'existing_appointment_id', v_existing_appointment_id
        )
      );
    END IF;
  END IF;

  -- Buscar ou criar paciente (filtrado por cliente_id)
  SELECT id INTO v_paciente_id
  FROM pacientes
  WHERE LOWER(TRIM(nome_completo)) = LOWER(TRIM(p_nome_completo))
    AND celular = p_celular
    AND cliente_id = v_cliente_id
  LIMIT 1;

  IF v_paciente_id IS NULL THEN
    -- Criar novo paciente COM cliente_id
    INSERT INTO pacientes (nome_completo, data_nascimento, telefone, celular, convenio, cliente_id)
    VALUES (
      TRIM(p_nome_completo),
      CASE WHEN p_data_nascimento IS NOT NULL AND p_data_nascimento != '' 
           THEN p_data_nascimento::date 
           ELSE NULL 
      END,
      NULLIF(TRIM(p_telefone), ''),
      p_celular,
      NULLIF(TRIM(p_convenio), ''),
      v_cliente_id
    )
    RETURNING id INTO v_paciente_id;
  ELSE
    -- Atualizar dados do paciente existente
    UPDATE pacientes
    SET 
      data_nascimento = CASE WHEN p_data_nascimento IS NOT NULL AND p_data_nascimento != '' 
                             THEN p_data_nascimento::date 
                             ELSE data_nascimento 
                        END,
      telefone = COALESCE(NULLIF(TRIM(p_telefone), ''), telefone),
      convenio = COALESCE(NULLIF(TRIM(p_convenio), ''), convenio),
      updated_at = now()
    WHERE id = v_paciente_id;
  END IF;

  -- Determinar criado_por
  v_criado_por_usado := COALESCE(NULLIF(TRIM(p_criado_por), ''), 'Sistema');

  IF v_is_editing THEN
    -- Atualizar agendamento existente
    UPDATE agendamentos
    SET 
      paciente_id = v_paciente_id,
      atendimento_id = p_atendimento_id,
      observacoes = p_observacoes,
      updated_at = now()
    WHERE id = v_agendamento_id;

    v_warnings := array_append(v_warnings, 'Agendamento existente foi atualizado');
  ELSE
    -- Criar novo agendamento
    INSERT INTO agendamentos (
      paciente_id,
      medico_id,
      atendimento_id,
      data_agendamento,
      hora_agendamento,
      status,
      observacoes,
      criado_por,
      criado_por_user_id
    )
    VALUES (
      v_paciente_id,
      p_medico_id,
      p_atendimento_id,
      p_data_agendamento,
      p_hora_agendamento,
      'agendado',
      p_observacoes,
      v_criado_por_usado,
      p_criado_por_user_id
    )
    RETURNING id INTO v_agendamento_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'agendamento_id', v_agendamento_id,
    'paciente_id', v_paciente_id,
    'message', CASE WHEN v_is_editing THEN 'Agendamento atualizado com sucesso' ELSE 'Agendamento criado com sucesso' END,
    'is_editing', v_is_editing,
    'criado_por_usado', v_criado_por_usado,
    'warnings', v_warnings
  );

EXCEPTION
  WHEN others THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_type', 'database',
      'detail', SQLSTATE
    );
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION criar_agendamento_atomico(text, text, text, text, text, uuid, uuid, date, time, text, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION criar_agendamento_atomico(text, text, text, text, text, uuid, uuid, date, time, text, text, uuid) TO authenticated;