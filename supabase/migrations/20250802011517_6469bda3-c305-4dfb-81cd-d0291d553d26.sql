-- Criar função de validação de conflitos inteligente (corrigida)
CREATE OR REPLACE FUNCTION public.validar_conflito_agendamento(
  p_medico_id UUID,
  p_data_agendamento DATE,
  p_hora_agendamento TIME,
  p_agendamento_id_edicao UUID DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conflitos_count INTEGER;
  v_is_multiple_same_patient BOOLEAN := FALSE;
  v_result JSON;
BEGIN
  -- Lock específico para este horário
  PERFORM pg_advisory_xact_lock(
    hashtext(p_medico_id::text || p_data_agendamento::text || p_hora_agendamento::text)
  );

  -- Buscar agendamentos conflitantes no mesmo horário
  SELECT COUNT(*)
  INTO v_conflitos_count
  FROM public.agendamentos a
  WHERE a.medico_id = p_medico_id
    AND a.data_agendamento = p_data_agendamento
    AND a.hora_agendamento = p_hora_agendamento
    AND a.status IN ('agendado', 'confirmado')
    AND a.id != COALESCE(p_agendamento_id_edicao, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Se não há conflitos, retornar sucesso
  IF v_conflitos_count = 0 THEN
    RETURN json_build_object(
      'has_conflict', false,
      'message', 'Horário disponível'
    );
  END IF;

  -- Verificar se são agendamentos múltiplos do mesmo paciente
  -- (identificados por observações específicas ou padrão de timing)
  SELECT EXISTS(
    SELECT 1 FROM public.agendamentos a
    WHERE a.medico_id = p_medico_id
      AND a.data_agendamento = p_data_agendamento
      AND a.hora_agendamento = p_hora_agendamento
      AND a.status IN ('agendado', 'confirmado')
      AND (
        a.observacoes ILIKE '%Agendamento múltiplo:%'
        OR EXISTS(
          SELECT 1 FROM public.agendamentos a2
          WHERE a2.paciente_id = a.paciente_id
            AND a2.medico_id = p_medico_id
            AND a2.data_agendamento = p_data_agendamento
            AND a2.hora_agendamento = p_hora_agendamento
            AND a2.id != a.id
            AND a2.status IN ('agendado', 'confirmado')
        )
      )
  ) INTO v_is_multiple_same_patient;

  -- Se é agendamento múltiplo válido, permitir
  IF v_is_multiple_same_patient THEN
    RETURN json_build_object(
      'has_conflict', false,
      'message', 'Agendamento múltiplo detectado - permitido'
    );
  END IF;

  -- Conflito real detectado
  SELECT 
    json_build_object(
      'has_conflict', true,
      'conflict_type', 'different_patients',
      'message', 'Este horário já está ocupado por outro paciente',
      'existing_appointments', json_agg(
        json_build_object(
          'id', a.id,
          'paciente_nome', p.nome_completo,
          'atendimento_nome', at.nome,
          'status', a.status
        )
      )
    )
  INTO v_result
  FROM public.agendamentos a
  JOIN public.pacientes p ON a.paciente_id = p.id
  JOIN public.atendimentos at ON a.atendimento_id = at.id
  WHERE a.medico_id = p_medico_id
    AND a.data_agendamento = p_data_agendamento
    AND a.hora_agendamento = p_hora_agendamento
    AND a.status IN ('agendado', 'confirmado')
    AND a.id != COALESCE(p_agendamento_id_edicao, '00000000-0000-0000-0000-000000000000'::uuid);

  RETURN v_result;
END;
$$;

-- Atualizar função criar_agendamento_atomico para usar nova validação
CREATE OR REPLACE FUNCTION public.criar_agendamento_atomico(
  p_nome_completo text, 
  p_data_nascimento date, 
  p_convenio text, 
  p_telefone text, 
  p_celular text, 
  p_medico_id uuid, 
  p_atendimento_id uuid, 
  p_data_agendamento date, 
  p_hora_agendamento time without time zone, 
  p_observacoes text DEFAULT NULL::text, 
  p_criado_por text DEFAULT 'Recepcionista'::text, 
  p_criado_por_user_id uuid DEFAULT NULL::uuid, 
  p_agendamento_id_edicao uuid DEFAULT NULL::uuid, 
  p_force_update_patient boolean DEFAULT false
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_paciente_id UUID;
  v_agendamento_id UUID;
  v_doctor_record RECORD;
  v_patient_age INTEGER;
  v_blocked_check INTEGER;
  v_conflict_result JSON;
  v_result JSON;
  v_criado_por_nome TEXT;
  current_time_brazil TIMESTAMP WITH TIME ZONE;
  appointment_datetime TIMESTAMP WITH TIME ZONE;
  v_existing_patient_record RECORD;
  v_is_editing BOOLEAN := p_agendamento_id_edicao IS NOT NULL;
  v_warnings TEXT[] := '{}';
BEGIN
  -- Obter horário atual no Brasil
  current_time_brazil := now() AT TIME ZONE 'America/Sao_Paulo';
  appointment_datetime := (p_data_agendamento::text || ' ' || p_hora_agendamento::text)::timestamp AT TIME ZONE 'America/Sao_Paulo';

  -- NOVA VALIDAÇÃO INTELIGENTE DE CONFLITOS
  SELECT public.validar_conflito_agendamento(
    p_medico_id, 
    p_data_agendamento, 
    p_hora_agendamento, 
    p_agendamento_id_edicao
  ) INTO v_conflict_result;

  -- Se há conflito real, retornar erro
  IF (v_conflict_result->>'has_conflict')::boolean = true THEN
    RETURN json_build_object(
      'success', false,
      'error', v_conflict_result->>'message',
      'conflict_details', v_conflict_result
    );
  END IF;

  -- Buscar nome real do usuário
  IF p_criado_por_user_id IS NOT NULL THEN
    SELECT nome INTO v_criado_por_nome
    FROM public.profiles 
    WHERE user_id = p_criado_por_user_id
    LIMIT 1;
    v_criado_por_nome := COALESCE(v_criado_por_nome, p_criado_por);
  ELSE
    v_criado_por_nome := p_criado_por;
  END IF;

  -- Verificar se médico está ativo
  SELECT m.*, m.ativo, m.idade_minima, m.idade_maxima, m.convenios_aceitos
  INTO v_doctor_record
  FROM public.medicos m
  WHERE m.id = p_medico_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Médico não encontrado');
  END IF;
  
  IF NOT v_doctor_record.ativo THEN
    RETURN json_build_object('success', false, 'error', 'Médico não está ativo');
  END IF;
  
  -- Verificar bloqueios de agenda
  SELECT COUNT(*)
  INTO v_blocked_check
  FROM public.bloqueios_agenda
  WHERE medico_id = p_medico_id
    AND status = 'ativo'
    AND p_data_agendamento BETWEEN data_inicio AND data_fim;
  
  IF v_blocked_check > 0 THEN
    RETURN json_build_object('success', false, 'error', 'A agenda está bloqueada nesta data');
  END IF;
  
  -- Validar data/hora não é no passado (só para novos agendamentos)
  IF appointment_datetime < (current_time_brazil + interval '1 hour') AND NOT v_is_editing THEN
    RETURN json_build_object('success', false, 'error', 'Agendamento deve ser feito com pelo menos 1 hora de antecedência');
  END IF;
  
  -- Calcular idade do paciente para warnings
  SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_data_nascimento))::INTEGER
  INTO v_patient_age;
  
  -- Validações de idade e convênio como warnings
  IF v_doctor_record.idade_minima IS NOT NULL AND v_patient_age < v_doctor_record.idade_minima THEN
    v_warnings := array_append(v_warnings, 
      'ATENÇÃO: Paciente com ' || v_patient_age || ' anos está abaixo da idade mínima (' || v_doctor_record.idade_minima || ' anos) para este médico');
  END IF;
  
  IF v_doctor_record.idade_maxima IS NOT NULL AND v_patient_age > v_doctor_record.idade_maxima THEN
    v_warnings := array_append(v_warnings, 
      'ATENÇÃO: Paciente com ' || v_patient_age || ' anos está acima da idade máxima (' || v_doctor_record.idade_maxima || ' anos) para este médico');
  END IF;
  
  IF v_doctor_record.convenios_aceitos IS NOT NULL AND 
     array_length(v_doctor_record.convenios_aceitos, 1) > 0 AND
     NOT (p_convenio = ANY(v_doctor_record.convenios_aceitos)) THEN
    v_warnings := array_append(v_warnings, 
      'ATENÇÃO: Convênio "' || p_convenio || '" pode não ser aceito por este médico');
  END IF;
  
  -- Gerenciar paciente
  IF v_is_editing THEN
    SELECT paciente_id INTO v_paciente_id
    FROM public.agendamentos 
    WHERE id = p_agendamento_id_edicao;
    
    IF v_paciente_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Agendamento não encontrado para edição');
    END IF;
    
    UPDATE public.pacientes 
    SET 
      nome_completo = p_nome_completo,
      data_nascimento = p_data_nascimento,
      convenio = p_convenio,
      telefone = COALESCE(p_telefone, telefone),
      celular = COALESCE(p_celular, celular),
      updated_at = NOW()
    WHERE id = v_paciente_id;
  ELSE
    -- Buscar ou criar paciente
    SELECT * INTO v_existing_patient_record
    FROM public.pacientes
    WHERE LOWER(nome_completo) = LOWER(p_nome_completo)
      AND data_nascimento = p_data_nascimento
      AND convenio = p_convenio
    LIMIT 1;
    
    IF v_existing_patient_record.id IS NOT NULL THEN
      v_paciente_id := v_existing_patient_record.id;
      
      IF p_force_update_patient OR 
         v_existing_patient_record.telefone != p_telefone OR 
         v_existing_patient_record.celular != p_celular THEN
        UPDATE public.pacientes 
        SET 
          telefone = COALESCE(p_telefone, telefone),
          celular = COALESCE(p_celular, celular),
          updated_at = NOW()
        WHERE id = v_paciente_id;
      END IF;
    ELSE
      INSERT INTO public.pacientes (
        nome_completo, data_nascimento, convenio, telefone, celular
      ) VALUES (
        p_nome_completo, p_data_nascimento, p_convenio, p_telefone, COALESCE(p_celular, '')
      ) RETURNING id INTO v_paciente_id;
    END IF;
  END IF;
  
  -- Criar ou atualizar agendamento
  IF v_is_editing THEN
    UPDATE public.agendamentos 
    SET 
      medico_id = p_medico_id,
      atendimento_id = p_atendimento_id,
      data_agendamento = p_data_agendamento,
      hora_agendamento = p_hora_agendamento,
      convenio = p_convenio,
      observacoes = p_observacoes,
      updated_at = NOW()
    WHERE id = p_agendamento_id_edicao
    RETURNING id INTO v_agendamento_id;
  ELSE
    INSERT INTO public.agendamentos (
      paciente_id, medico_id, atendimento_id, data_agendamento, hora_agendamento,
      convenio, observacoes, criado_por, criado_por_user_id, status
    ) VALUES (
      v_paciente_id, p_medico_id, p_atendimento_id, p_data_agendamento, p_hora_agendamento,
      p_convenio, p_observacoes, v_criado_por_nome, p_criado_por_user_id, 'agendado'
    ) RETURNING id INTO v_agendamento_id;
  END IF;
  
  -- Retornar sucesso com warnings se houver
  RETURN json_build_object(
    'success', true,
    'agendamento_id', v_agendamento_id,
    'paciente_id', v_paciente_id,
    'criado_por_usado', v_criado_por_nome,
    'is_editing', v_is_editing,
    'conflict_check', v_conflict_result,
    'warnings', CASE WHEN array_length(v_warnings, 1) > 0 THEN v_warnings ELSE NULL END,
    'message', CASE WHEN v_is_editing THEN 'Agendamento atualizado com sucesso' ELSE 'Agendamento criado com sucesso' END
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erro interno: ' || SQLERRM);
END;
$$;