
-- Drop the OLD version (where p_telefone comes before p_convenio)
DROP FUNCTION IF EXISTS public.criar_agendamento_atomico(
  text, text, text, text, text, uuid, uuid, text, text, text, text, uuid, uuid, boolean
);

-- Drop the NEW version (where p_convenio comes before p_telefone) 
DROP FUNCTION IF EXISTS public.criar_agendamento_atomico(
  p_nome_completo text,
  p_data_nascimento text,
  p_convenio text,
  p_telefone text,
  p_celular text,
  p_medico_id uuid,
  p_atendimento_id uuid,
  p_data_agendamento text,
  p_hora_agendamento text,
  p_observacoes text,
  p_criado_por text,
  p_criado_por_user_id uuid,
  p_agendamento_id_edicao uuid,
  p_force_conflict boolean
);

-- Drop the other signature too
DROP FUNCTION IF EXISTS public.criar_agendamento_atomico(
  p_nome_completo text,
  p_data_nascimento text,
  p_telefone text,
  p_celular text,
  p_convenio text,
  p_medico_id uuid,
  p_atendimento_id uuid,
  p_data_agendamento text,
  p_hora_agendamento text,
  p_observacoes text,
  p_criado_por text,
  p_criado_por_user_id uuid,
  p_agendamento_id_edicao uuid,
  p_force_conflict boolean
);

-- Recreate with ONE canonical signature (convenio before telefone, matching the frontend call order)
CREATE OR REPLACE FUNCTION public.criar_agendamento_atomico(
  p_nome_completo TEXT,
  p_data_nascimento TEXT DEFAULT NULL,
  p_convenio TEXT DEFAULT 'Particular',
  p_telefone TEXT DEFAULT NULL,
  p_celular TEXT DEFAULT NULL,
  p_medico_id UUID DEFAULT NULL,
  p_atendimento_id UUID DEFAULT NULL,
  p_data_agendamento TEXT DEFAULT NULL,
  p_hora_agendamento TEXT DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL,
  p_criado_por TEXT DEFAULT 'Sistema',
  p_criado_por_user_id UUID DEFAULT NULL,
  p_agendamento_id_edicao UUID DEFAULT NULL,
  p_force_conflict BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id UUID;
  v_agendamento_id UUID;
  v_cliente_id UUID;
  v_medico_ativo BOOLEAN;
  v_conflict_exists BOOLEAN := FALSE;
  v_conflict_paciente TEXT;
  v_is_editing BOOLEAN := (p_agendamento_id_edicao IS NOT NULL);
  v_warnings TEXT[] := ARRAY[]::TEXT[];
  v_result JSONB;
BEGIN
  -- 1. Validações básicas
  IF p_nome_completo IS NULL OR trim(p_nome_completo) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome completo é obrigatório');
  END IF;
  
  IF p_medico_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Médico é obrigatório');
  END IF;
  
  IF p_atendimento_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tipo de atendimento é obrigatório');
  END IF;
  
  IF p_data_agendamento IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Data do agendamento é obrigatória');
  END IF;
  
  IF p_hora_agendamento IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hora do agendamento é obrigatória');
  END IF;

  -- 2. Verificar se médico está ativo e obter cliente_id
  SELECT ativo, cliente_id INTO v_medico_ativo, v_cliente_id
  FROM medicos WHERE id = p_medico_id;
  
  IF v_medico_ativo IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Médico não encontrado');
  END IF;
  
  IF NOT v_medico_ativo THEN
    RETURN jsonb_build_object('success', false, 'error', 'Médico não está ativo');
  END IF;

  -- 3. Verificar conflito de horário (mesmo médico, mesma data, mesmo horário)
  IF NOT p_force_conflict THEN
    SELECT EXISTS(
      SELECT 1 FROM agendamentos
      WHERE medico_id = p_medico_id
        AND data_agendamento = p_data_agendamento::date
        AND hora_agendamento = p_hora_agendamento::time
        AND status IN ('agendado', 'confirmado')
        AND (NOT v_is_editing OR id != p_agendamento_id_edicao)
        AND cliente_id = v_cliente_id
    ) INTO v_conflict_exists;
    
    IF v_conflict_exists THEN
      -- Buscar nome do paciente no conflito
      SELECT p.nome_completo INTO v_conflict_paciente
      FROM agendamentos a
      JOIN pacientes p ON p.id = a.paciente_id
      WHERE a.medico_id = p_medico_id
        AND a.data_agendamento = p_data_agendamento::date
        AND a.hora_agendamento = p_hora_agendamento::time
        AND a.status IN ('agendado', 'confirmado')
        AND a.cliente_id = v_cliente_id
        AND (NOT v_is_editing OR a.id != p_agendamento_id_edicao)
      LIMIT 1;
      
      RETURN jsonb_build_object(
        'success', false,
        'error', 'CONFLICT',
        'conflict_detected', true,
        'message', format('Já existe um agendamento para %s neste horário (%s às %s). Paciente: %s. Deseja agendar mesmo assim?',
          to_char(p_data_agendamento::date, 'DD/MM/YYYY'), p_hora_agendamento, p_hora_agendamento, COALESCE(v_conflict_paciente, 'Desconhecido')),
        'conflict_details', jsonb_build_object(
          'paciente_conflito', v_conflict_paciente,
          'data', p_data_agendamento,
          'hora', p_hora_agendamento
        )
      );
    END IF;
  END IF;

  -- 4. Buscar ou criar paciente (usando lower+trim para match com índice)
  SELECT id INTO v_paciente_id
  FROM pacientes
  WHERE cliente_id = v_cliente_id
    AND lower(trim(nome_completo)) = lower(trim(p_nome_completo))
    AND (
      (p_data_nascimento IS NOT NULL AND data_nascimento = p_data_nascimento::date)
      OR (p_data_nascimento IS NULL AND data_nascimento IS NULL)
    )
  LIMIT 1;
  
  IF v_paciente_id IS NULL THEN
    -- Criar novo paciente com ON CONFLICT para segurança
    INSERT INTO pacientes (nome_completo, data_nascimento, convenio, telefone, celular, cliente_id)
    VALUES (
      trim(p_nome_completo),
      CASE WHEN p_data_nascimento IS NOT NULL AND p_data_nascimento != '' THEN p_data_nascimento::date ELSE NULL END,
      COALESCE(p_convenio, 'Particular'),
      p_telefone,
      p_celular,
      v_cliente_id
    )
    ON CONFLICT (cliente_id, lower(TRIM(BOTH FROM (nome_completo)::text)), data_nascimento)
    WHERE data_nascimento IS NOT NULL
    DO UPDATE SET
      convenio = COALESCE(EXCLUDED.convenio, pacientes.convenio),
      celular = COALESCE(EXCLUDED.celular, pacientes.celular),
      telefone = COALESCE(EXCLUDED.telefone, pacientes.telefone),
      updated_at = now()
    RETURNING id INTO v_paciente_id;
    
    -- If still null (null birth date case), try fetching again
    IF v_paciente_id IS NULL THEN
      SELECT id INTO v_paciente_id
      FROM pacientes
      WHERE cliente_id = v_cliente_id
        AND lower(trim(nome_completo)) = lower(trim(p_nome_completo))
        AND data_nascimento IS NULL
      LIMIT 1;
      
      IF v_paciente_id IS NULL THEN
        INSERT INTO pacientes (nome_completo, data_nascimento, convenio, telefone, celular, cliente_id)
        VALUES (trim(p_nome_completo), NULL, COALESCE(p_convenio, 'Particular'), p_telefone, p_celular, v_cliente_id)
        RETURNING id INTO v_paciente_id;
      END IF;
    END IF;
  ELSE
    -- Atualizar dados do paciente existente
    UPDATE pacientes SET
      convenio = COALESCE(p_convenio, convenio),
      celular = COALESCE(p_celular, celular),
      telefone = COALESCE(p_telefone, telefone),
      updated_at = now()
    WHERE id = v_paciente_id;
  END IF;

  -- 5. Criar ou editar agendamento
  IF v_is_editing THEN
    UPDATE agendamentos SET
      paciente_id = v_paciente_id,
      medico_id = p_medico_id,
      atendimento_id = p_atendimento_id,
      data_agendamento = p_data_agendamento::date,
      hora_agendamento = p_hora_agendamento::time,
      observacoes = p_observacoes,
      convenio = COALESCE(p_convenio, 'Particular'),
      criado_por = p_criado_por,
      criado_por_user_id = p_criado_por_user_id,
      alterado_por_user_id = p_criado_por_user_id,
      updated_at = now()
    WHERE id = p_agendamento_id_edicao
      AND cliente_id = v_cliente_id;
    
    v_agendamento_id := p_agendamento_id_edicao;
  ELSE
    INSERT INTO agendamentos (
      paciente_id, medico_id, atendimento_id,
      data_agendamento, hora_agendamento,
      observacoes, convenio, criado_por, criado_por_user_id,
      status, cliente_id
    ) VALUES (
      v_paciente_id, p_medico_id, p_atendimento_id,
      p_data_agendamento::date, p_hora_agendamento::time,
      p_observacoes, COALESCE(p_convenio, 'Particular'), p_criado_por, p_criado_por_user_id,
      'agendado', v_cliente_id
    )
    RETURNING id INTO v_agendamento_id;
  END IF;

  -- 6. Retornar sucesso
  v_result := jsonb_build_object(
    'success', true,
    'agendamento_id', v_agendamento_id,
    'paciente_id', v_paciente_id,
    'is_editing', v_is_editing,
    'criado_por_usado', p_criado_por
  );
  
  IF array_length(v_warnings, 1) > 0 THEN
    v_result := v_result || jsonb_build_object('warnings', to_jsonb(v_warnings));
  END IF;
  
  RETURN v_result;
END;
$$;
