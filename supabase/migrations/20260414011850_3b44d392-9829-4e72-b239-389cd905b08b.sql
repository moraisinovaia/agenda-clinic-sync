
CREATE OR REPLACE FUNCTION public.criar_agendamento_atomico(
  p_nome_completo text,
  p_data_nascimento text DEFAULT NULL,
  p_convenio text DEFAULT 'Particular',
  p_telefone text DEFAULT NULL,
  p_celular text DEFAULT NULL,
  p_medico_id uuid DEFAULT NULL,
  p_atendimento_id uuid DEFAULT NULL,
  p_data_agendamento text DEFAULT NULL,
  p_hora_agendamento text DEFAULT NULL,
  p_observacoes text DEFAULT NULL,
  p_criado_por text DEFAULT 'Sistema',
  p_criado_por_user_id uuid DEFAULT NULL,
  p_agendamento_id_edicao uuid DEFAULT NULL,
  p_force_conflict boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id uuid;
  v_agendamento_id uuid;
  v_cliente_id uuid;
  v_medico_nome text;
  v_conflito_existente record;
  v_data_convertida date;
  v_hora_convertida time;
  v_warnings text[] := ARRAY[]::text[];
  v_is_editing boolean := false;
  v_criado_por_usado text;
  v_status_anterior text;
BEGIN
  -- Validações básicas
  IF p_nome_completo IS NULL OR trim(p_nome_completo) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Nome do paciente é obrigatório'
    );
  END IF;

  IF p_celular IS NULL OR trim(p_celular) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Celular é obrigatório'
    );
  END IF;

  -- Converter data e hora de text para tipos nativos
  BEGIN
    v_data_convertida := p_data_agendamento::date;
    v_hora_convertida := p_hora_agendamento::time;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Formato de data ou hora inválido. Use YYYY-MM-DD para data e HH:MM para hora.'
    );
  END;

  -- Buscar cliente_id do médico (CRÍTICO para multiclientes)
  SELECT m.cliente_id, m.nome INTO v_cliente_id, v_medico_nome
  FROM medicos m
  WHERE m.id = p_medico_id;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Médico não encontrado ou sem clínica associada'
    );
  END IF;

  -- Determinar se é edição ou novo agendamento
  IF p_agendamento_id_edicao IS NOT NULL THEN
    v_is_editing := true;
    v_agendamento_id := p_agendamento_id_edicao;
    
    SELECT status INTO v_status_anterior
    FROM agendamentos
    WHERE id = p_agendamento_id_edicao;
  END IF;

  -- Verificar conflitos de horário
  SELECT id, paciente_id INTO v_conflito_existente
  FROM agendamentos
  WHERE medico_id = p_medico_id
    AND data_agendamento = v_data_convertida
    AND hora_agendamento = v_hora_convertida
    AND status NOT IN ('cancelado', 'excluido', 'cancelado_bloqueio')
    AND (p_agendamento_id_edicao IS NULL OR id != p_agendamento_id_edicao);

  IF v_conflito_existente.id IS NOT NULL AND NOT p_force_conflict THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Já existe um agendamento para este médico neste horário',
      'conflict_detected', true,
      'conflict_details', jsonb_build_object(
        'agendamento_id', v_conflito_existente.id,
        'paciente_id', v_conflito_existente.paciente_id
      )
    );
  END IF;

  -- ✅ CORRIGIDO: Buscar paciente usando lower(trim()) para coincidir com o índice único
  SELECT id INTO v_paciente_id
  FROM pacientes
  WHERE lower(trim(nome_completo)) = lower(trim(p_nome_completo))
    AND data_nascimento = p_data_nascimento::date
    AND cliente_id = v_cliente_id
  LIMIT 1;

  IF v_paciente_id IS NULL THEN
    -- Tentar busca sem data_nascimento (para casos onde data_nascimento é NULL)
    IF p_data_nascimento IS NULL THEN
      SELECT id INTO v_paciente_id
      FROM pacientes
      WHERE lower(trim(nome_completo)) = lower(trim(p_nome_completo))
        AND data_nascimento IS NULL
        AND cliente_id = v_cliente_id
      LIMIT 1;
    END IF;
  END IF;

  IF v_paciente_id IS NULL THEN
    -- ✅ CORRIGIDO: INSERT com ON CONFLICT para evitar race conditions
    INSERT INTO pacientes (
      nome_completo,
      data_nascimento,
      telefone,
      celular,
      convenio,
      cliente_id
    ) VALUES (
      trim(p_nome_completo),
      p_data_nascimento::date,
      nullif(trim(p_telefone), ''),
      trim(p_celular),
      coalesce(trim(p_convenio), 'Particular'),
      v_cliente_id
    )
    ON CONFLICT (cliente_id, lower(TRIM(BOTH FROM (nome_completo)::text)), data_nascimento)
    WHERE data_nascimento IS NOT NULL
    DO UPDATE SET
      telefone = coalesce(nullif(trim(EXCLUDED.telefone), ''), pacientes.telefone),
      celular = coalesce(nullif(trim(EXCLUDED.celular), ''), pacientes.celular),
      convenio = coalesce(nullif(trim(EXCLUDED.convenio), ''), pacientes.convenio),
      updated_at = now()
    RETURNING id INTO v_paciente_id;

    v_warnings := array_append(v_warnings, 'Novo paciente cadastrado automaticamente');
  ELSE
    -- Atualizar dados do paciente existente
    UPDATE pacientes SET
      telefone = coalesce(nullif(trim(p_telefone), ''), telefone),
      celular = coalesce(nullif(trim(p_celular), ''), celular),
      convenio = coalesce(nullif(trim(p_convenio), ''), convenio),
      updated_at = now()
    WHERE id = v_paciente_id;
  END IF;

  -- Determinar criado_por
  v_criado_por_usado := coalesce(p_criado_por, 'Sistema');

  IF v_is_editing THEN
    UPDATE agendamentos SET
      paciente_id = v_paciente_id,
      medico_id = p_medico_id,
      atendimento_id = p_atendimento_id,
      data_agendamento = v_data_convertida,
      hora_agendamento = v_hora_convertida,
      observacoes = p_observacoes,
      updated_at = now(),
      alterado_por_user_id = p_criado_por_user_id,
      status = CASE 
        WHEN status = 'cancelado_bloqueio' THEN coalesce(v_status_anterior, 'agendado')
        ELSE status
      END
    WHERE id = p_agendamento_id_edicao;
  ELSE
    INSERT INTO agendamentos (
      paciente_id,
      medico_id,
      atendimento_id,
      data_agendamento,
      hora_agendamento,
      observacoes,
      criado_por,
      criado_por_user_id,
      cliente_id,
      status,
      convenio
    ) VALUES (
      v_paciente_id,
      p_medico_id,
      p_atendimento_id,
      v_data_convertida,
      v_hora_convertida,
      p_observacoes,
      v_criado_por_usado,
      p_criado_por_user_id,
      v_cliente_id,
      'agendado',
      coalesce(trim(p_convenio), 'Particular')
    )
    RETURNING id INTO v_agendamento_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'agendamento_id', coalesce(v_agendamento_id, p_agendamento_id_edicao),
    'paciente_id', v_paciente_id,
    'medico_nome', v_medico_nome,
    'data', p_data_agendamento,
    'hora', p_hora_agendamento,
    'is_editing', v_is_editing,
    'warnings', to_jsonb(v_warnings)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Erro ao processar agendamento: ' || SQLERRM
  );
END;
$$;
