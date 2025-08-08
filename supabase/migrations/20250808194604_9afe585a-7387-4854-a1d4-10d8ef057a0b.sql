-- 1) Atualizar validação de idade para NUNCA bloquear, apenas adicionar observação
CREATE OR REPLACE FUNCTION public.validate_patient_age_for_doctor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  patient_age INTEGER;
  doctor_min_age INTEGER;
  doctor_max_age INTEGER;
  age_note TEXT := '';
BEGIN
  -- Buscar idade do paciente
  SELECT EXTRACT(YEAR FROM AGE(current_date, p.data_nascimento))::INTEGER
  INTO patient_age
  FROM public.pacientes p
  WHERE p.id = NEW.paciente_id;
  
  -- Buscar restrições de idade do médico
  SELECT m.idade_minima, m.idade_maxima
  INTO doctor_min_age, doctor_max_age
  FROM public.medicos m
  WHERE m.id = NEW.medico_id;
  
  -- Montar observação (sem bloquear)
  IF doctor_min_age IS NOT NULL AND patient_age < doctor_min_age THEN
    age_note := age_note || format(' [Idade %s anos - abaixo do padrão %s anos]', patient_age, doctor_min_age);
  END IF;
  
  IF doctor_max_age IS NOT NULL AND patient_age > doctor_max_age THEN
    age_note := age_note || format(' [Idade %s anos - acima do padrão %s anos]', patient_age, doctor_max_age);
  END IF;

  -- Se houver observação de idade, anexar em NEW.observacoes
  IF age_note <> '' THEN
    NEW.observacoes := coalesce(NEW.observacoes, '') || age_note;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2) Atualizar RPC de múltiplos agendamentos para transformar idade em aviso (sem EXCEPTION)
CREATE OR REPLACE FUNCTION public.criar_agendamento_multiplo(
  p_nome_completo text,
  p_data_nascimento date,
  p_convenio text,
  p_telefone text,
  p_celular text,
  p_medico_id uuid,
  p_atendimento_ids uuid[],
  p_data_agendamento date,
  p_hora_agendamento time without time zone,
  p_observacoes text DEFAULT NULL::text,
  p_criado_por text DEFAULT 'recepcionista'::text,
  p_criado_por_user_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_paciente_id UUID;
  v_agendamento_ids UUID[] := '{}';
  v_doctor_record RECORD;
  v_patient_age INTEGER;
  v_blocked_check INTEGER;
  v_result JSON;
  v_atendimento_id UUID;
  v_current_agendamento_id UUID;
  v_combined_observations TEXT := '';
  v_atendimento_name TEXT;
  v_atendimento_names TEXT[] := '{}';
  v_age_note TEXT := '';
BEGIN
  -- Validar que há pelo menos um atendimento
  IF array_length(p_atendimento_ids, 1) IS NULL OR array_length(p_atendimento_ids, 1) = 0 THEN
    RAISE EXCEPTION 'É necessário selecionar pelo menos um atendimento';
  END IF;

  -- Buscar nomes dos atendimentos
  FOR v_atendimento_id IN SELECT unnest(p_atendimento_ids)
  LOOP
    SELECT nome INTO v_atendimento_name FROM public.atendimentos WHERE id = v_atendimento_id;
    IF v_atendimento_name IS NOT NULL THEN
      v_atendimento_names := array_append(v_atendimento_names, v_atendimento_name);
    END IF;
  END LOOP;

  -- Observação combinada base
  IF array_length(v_atendimento_names, 1) > 1 THEN
    v_combined_observations := 'Agendamento múltiplo: ' || array_to_string(v_atendimento_names, ' + ');
    IF p_observacoes IS NOT NULL AND trim(p_observacoes) <> '' THEN
      v_combined_observations := v_combined_observations || '. ' || p_observacoes;
    END IF;
  ELSE
    v_combined_observations := p_observacoes;
  END IF;
  
  -- Verificar se médico está ativo e buscar restrições
  SELECT m.*, m.ativo, m.idade_minima, m.idade_maxima, m.convenios_aceitos
  INTO v_doctor_record
  FROM public.medicos m
  WHERE m.id = p_medico_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Médico não encontrado';
  END IF;
  
  IF NOT v_doctor_record.ativo THEN
    RAISE EXCEPTION 'Médico não está ativo';
  END IF;
  
  -- Verificar bloqueios de agenda
  SELECT COUNT(*)
  INTO v_blocked_check
  FROM public.bloqueios_agenda
  WHERE medico_id = p_medico_id
    AND status = 'ativo'
    AND p_data_agendamento BETWEEN data_inicio AND data_fim;
  
  IF v_blocked_check > 0 THEN
    RAISE EXCEPTION 'A agenda está bloqueada nesta data';
  END IF;
  
  -- Validar data/hora não é no passado
  IF (p_data_agendamento::timestamp + p_hora_agendamento) < (now() - interval '1 hour') THEN
    RAISE EXCEPTION 'Não é possível agendar para uma data/hora que já passou';
  END IF;
  
  -- Calcular idade do paciente e gerar NOTAS (sem bloquear)
  SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_data_nascimento))::INTEGER
  INTO v_patient_age;
  
  IF v_doctor_record.idade_minima IS NOT NULL AND v_patient_age < v_doctor_record.idade_minima THEN
    v_age_note := v_age_note || format(' [Idade %s anos - abaixo do padrão %s anos]', v_patient_age, v_doctor_record.idade_minima);
  END IF;
  
  IF v_doctor_record.idade_maxima IS NOT NULL AND v_patient_age > v_doctor_record.idade_maxima THEN
    v_age_note := v_age_note || format(' [Idade %s anos - acima do padrão %s anos]', v_patient_age, v_doctor_record.idade_maxima);
  END IF;

  -- Validar convênio aceito (mantém bloqueio se não aceito)
  IF v_doctor_record.convenios_aceitos IS NOT NULL AND 
     array_length(v_doctor_record.convenios_aceitos, 1) > 0 AND
     NOT (p_convenio = ANY(v_doctor_record.convenios_aceitos)) THEN
    RAISE EXCEPTION 'Convênio "%" não é aceito por este médico', p_convenio;
  END IF;
  
  -- Criar ou buscar paciente existente
  SELECT id INTO v_paciente_id
  FROM public.pacientes
  WHERE LOWER(nome_completo) = LOWER(p_nome_completo)
    AND data_nascimento = p_data_nascimento
    AND convenio = p_convenio
  LIMIT 1;
  
  IF v_paciente_id IS NULL THEN
    INSERT INTO public.pacientes (
      nome_completo, data_nascimento, convenio, telefone, celular
    ) VALUES (
      p_nome_completo, p_data_nascimento, p_convenio, p_telefone, COALESCE(p_celular, '')
    ) RETURNING id INTO v_paciente_id;
  END IF;
  
  -- Criar um agendamento por atendimento
  FOR v_atendimento_id IN SELECT unnest(p_atendimento_ids)
  LOOP
    INSERT INTO public.agendamentos (
      paciente_id, medico_id, atendimento_id, data_agendamento, hora_agendamento,
      convenio, observacoes, criado_por, criado_por_user_id, status
    ) VALUES (
      v_paciente_id, p_medico_id, v_atendimento_id, p_data_agendamento, p_hora_agendamento,
      p_convenio, coalesce(v_combined_observations, '') || coalesce(v_age_note, ''), p_criado_por, p_criado_por_user_id, 'agendado'
    ) RETURNING id INTO v_current_agendamento_id;
    
    v_agendamento_ids := array_append(v_agendamento_ids, v_current_agendamento_id);
  END LOOP;
  
  -- Retorno
  SELECT json_build_object(
    'success', true,
    'agendamento_ids', v_agendamento_ids,
    'paciente_id', v_paciente_id,
    'total_agendamentos', array_length(v_agendamento_ids, 1),
    'atendimentos', v_atendimento_names,
    'message', CASE WHEN v_age_note <> '' THEN 
      'Agendamento múltiplo criado com observações de idade' 
    ELSE 'Agendamento múltiplo criado com sucesso' END
  ) INTO v_result;
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Erro ao criar agendamento múltiplo: ' || SQLERRM
    );
END;
$$;

-- 3) Garantir que o RPC atomico também é somente AVISO para idade (mantendo p_force_conflict)
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
  p_force_update_patient boolean DEFAULT false,
  p_force_conflict boolean DEFAULT false
)
RETURNS json
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
  v_criado_por_nome TEXT;
  current_time_brazil TIMESTAMP WITH TIME ZONE;
  appointment_datetime TIMESTAMP WITH TIME ZONE;
  v_existing_patient_record RECORD;
  v_is_editing BOOLEAN := p_agendamento_id_edicao IS NOT NULL;
  v_warnings TEXT[] := '{}';
  v_atendimento_check INTEGER;
  v_age_note TEXT := '';
BEGIN
  IF p_atendimento_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tipo de atendimento é obrigatório');
  END IF;

  SELECT COUNT(*) INTO v_atendimento_check
  FROM public.atendimentos 
  WHERE id = p_atendimento_id AND ativo = true;
  
  IF v_atendimento_check = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Tipo de atendimento inválido ou inativo');
  END IF;

  IF p_medico_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_atendimento_check
    FROM public.atendimentos 
    WHERE id = p_atendimento_id 
      AND (medico_id = p_medico_id OR medico_id IS NULL)
      AND ativo = true;
    
    IF v_atendimento_check = 0 THEN
      RETURN json_build_object('success', false, 'error', 'Este tipo de atendimento não está disponível para o médico selecionado');
    END IF;
  END IF;

  current_time_brazil := now() AT TIME ZONE 'America/Sao_Paulo';
  appointment_datetime := (p_data_agendamento::text || ' ' || p_hora_agendamento::text)::timestamp AT TIME ZONE 'America/Sao_Paulo';

  -- Validar conflito (somente bloqueia se não for forçado)
  IF NOT p_force_conflict THEN
    SELECT public.validar_conflito_agendamento(
      p_medico_id, p_data_agendamento, p_hora_agendamento, p_agendamento_id_edicao
    ) INTO v_conflict_result;

    IF (v_conflict_result->>'has_conflict')::boolean = true THEN
      RETURN json_build_object(
        'success', false,
        'conflict_detected', true,
        'conflict_message', v_conflict_result->>'message',
        'conflict_details', v_conflict_result,
        'message', 'Horário ocupado - confirme para prosseguir'
      );
    END IF;
  END IF;

  -- Buscar nome real do usuário
  IF p_criado_por_user_id IS NOT NULL THEN
    SELECT nome INTO v_criado_por_nome
    FROM public.profiles WHERE user_id = p_criado_por_user_id LIMIT 1;
    v_criado_por_nome := COALESCE(v_criado_por_nome, p_criado_por);
  ELSE
    v_criado_por_nome := p_criado_por;
  END IF;

  -- Médico ativo e restrições
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

  -- Bloqueios de agenda
  SELECT COUNT(*) INTO v_blocked_check
  FROM public.bloqueios_agenda
  WHERE medico_id = p_medico_id
    AND status = 'ativo'
    AND p_data_agendamento BETWEEN data_inicio AND data_fim;
  
  IF v_blocked_check > 0 THEN
    RETURN json_build_object('success', false, 'error', 'A agenda está bloqueada nesta data');
  END IF;

  -- Data/hora no passado (só para novos)
  IF appointment_datetime < (current_time_brazil + interval '1 hour') AND NOT v_is_editing THEN
    RETURN json_build_object('success', false, 'error', 'Agendamento deve ser feito com pelo menos 1 hora de antecedência');
  END IF;
  
  -- Idade: somente AVISO
  SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_data_nascimento))::INTEGER
  INTO v_patient_age;
  
  IF v_doctor_record.idade_minima IS NOT NULL AND v_patient_age < v_doctor_record.idade_minima THEN
    v_warnings := array_append(v_warnings, 
      'ATENÇÃO: Paciente com ' || v_patient_age || ' anos está abaixo da idade mínima (' || v_doctor_record.idade_minima || ' anos) para este médico');
    v_age_note := v_age_note || ' [Idade ' || v_patient_age || ' anos - abaixo do padrão ' || v_doctor_record.idade_minima || ' anos]';
  END IF;
  
  IF v_doctor_record.idade_maxima IS NOT NULL AND v_patient_age > v_doctor_record.idade_maxima THEN
    v_warnings := array_append(v_warnings, 
      'ATENÇÃO: Paciente com ' || v_patient_age || ' anos está acima da idade máxima (' || v_doctor_record.idade_maxima || ' anos) para este médico');
    v_age_note := v_age_note || ' [Idade ' || v_patient_age || ' anos - acima do padrão ' || v_doctor_record.idade_maxima || ' anos]';
  END IF;
  
  IF v_doctor_record.convenios_aceitos IS NOT NULL AND 
     array_length(v_doctor_record.convenios_aceitos, 1) > 0 AND
     NOT (p_convenio = ANY(v_doctor_record.convenios_aceitos)) THEN
    v_warnings := array_append(v_warnings, 
      'ATENÇÃO: Convênio "' || p_convenio || '" pode não ser aceito por este médico');
  END IF;

  -- Gerenciar paciente (buscar/atualizar/criar)
  IF v_is_editing THEN
    SELECT paciente_id INTO v_paciente_id FROM public.agendamentos WHERE id = p_agendamento_id_edicao;
    IF v_paciente_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Agendamento não encontrado para edição');
    END IF;
    UPDATE public.pacientes 
    SET nome_completo = p_nome_completo,
        data_nascimento = p_data_nascimento,
        convenio = p_convenio,
        telefone = COALESCE(p_telefone, telefone),
        celular = COALESCE(p_celular, celular),
        updated_at = NOW()
    WHERE id = v_paciente_id;
  ELSE
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
        SET telefone = COALESCE(p_telefone, telefone),
            celular = COALESCE(p_celular, celular),
            updated_at = NOW()
        WHERE id = v_paciente_id;
      END IF;
    ELSE
      INSERT INTO public.pacientes (nome_completo, data_nascimento, convenio, telefone, celular)
      VALUES (p_nome_completo, p_data_nascimento, p_convenio, p_telefone, COALESCE(p_celular, ''))
      RETURNING id INTO v_paciente_id;
    END IF;
  END IF;

  -- Criar/atualizar agendamento com notas
  IF v_is_editing THEN
    UPDATE public.agendamentos 
    SET medico_id = p_medico_id,
        atendimento_id = p_atendimento_id,
        data_agendamento = p_data_agendamento,
        hora_agendamento = p_hora_agendamento,
        convenio = p_convenio,
        observacoes = CASE 
          WHEN p_force_conflict THEN COALESCE(p_observacoes, '') || ' [AGENDAMENTO FORÇADO COM CONFLITO]' || v_age_note
          ELSE COALESCE(p_observacoes, '') || v_age_note
        END,
        updated_at = NOW()
    WHERE id = p_agendamento_id_edicao
    RETURNING id INTO v_agendamento_id;
  ELSE
    INSERT INTO public.agendamentos (
      paciente_id, medico_id, atendimento_id, data_agendamento, hora_agendamento,
      convenio, observacoes, criado_por, criado_por_user_id, status
    ) VALUES (
      v_paciente_id, p_medico_id, p_atendimento_id, p_data_agendamento, p_hora_agendamento,
      p_convenio,
      CASE WHEN p_force_conflict THEN COALESCE(p_observacoes, '') || ' [AGENDAMENTO FORÇADO COM CONFLITO]' || v_age_note
           ELSE COALESCE(p_observacoes, '') || v_age_note END,
      v_criado_por_nome, p_criado_por_user_id, 'agendado'
    ) RETURNING id INTO v_agendamento_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'agendamento_id', v_agendamento_id,
    'paciente_id', v_paciente_id,
    'criado_por_usado', v_criado_por_nome,
    'is_editing', v_is_editing,
    'forced_conflict', p_force_conflict,
    'warnings', CASE WHEN array_length(v_warnings, 1) > 0 THEN v_warnings ELSE NULL END,
    'message', CASE 
      WHEN v_is_editing THEN 'Agendamento atualizado com sucesso' 
      WHEN p_force_conflict THEN 'Agendamento criado com conflito forçado'
      WHEN array_length(v_warnings, 1) > 0 THEN 'Agendamento criado com observações de idade'
      ELSE 'Agendamento criado com sucesso' 
    END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erro interno: ' || SQLERRM);
END;
$$;