-- Modificar função criar_agendamento_atomico para aceitar flag force_conflict
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
  p_force_conflict boolean DEFAULT false  -- NOVO PARÂMETRO
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_atendimento_check INTEGER;
BEGIN
  -- ✅ VALIDAÇÃO CRÍTICA: Verificar se atendimento foi fornecido
  IF p_atendimento_id IS NULL THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Tipo de atendimento é obrigatório'
    );
  END IF;

  -- ✅ VALIDAÇÃO ADICIONAL: Verificar se atendimento existe e está ativo
  SELECT COUNT(*) INTO v_atendimento_check
  FROM public.atendimentos 
  WHERE id = p_atendimento_id AND ativo = true;
  
  IF v_atendimento_check = 0 THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Tipo de atendimento inválido ou inativo'
    );
  END IF;

  -- ✅ VALIDAÇÃO DE MÉDICO: Verificar se atendimento pertence ao médico
  IF p_medico_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_atendimento_check
    FROM public.atendimentos 
    WHERE id = p_atendimento_id 
      AND (medico_id = p_medico_id OR medico_id IS NULL)
      AND ativo = true;
    
    IF v_atendimento_check = 0 THEN
      RETURN json_build_object(
        'success', false, 
        'error', 'Este tipo de atendimento não está disponível para o médico selecionado'
      );
    END IF;
  END IF;

  -- Obter horário atual no Brasil
  current_time_brazil := now() AT TIME ZONE 'America/Sao_Paulo';
  appointment_datetime := (p_data_agendamento::text || ' ' || p_hora_agendamento::text)::timestamp AT TIME ZONE 'America/Sao_Paulo';

  -- ✅ NOVA LÓGICA: Validar conflito apenas se não for forçado
  IF NOT p_force_conflict THEN
    SELECT public.validar_conflito_agendamento(
      p_medico_id, 
      p_data_agendamento, 
      p_hora_agendamento, 
      p_agendamento_id_edicao
    ) INTO v_conflict_result;

    -- Se há conflito real, retornar como WARNING ao invés de erro fatal
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
      observacoes = CASE 
        WHEN p_force_conflict THEN 
          COALESCE(p_observacoes, '') || ' [AGENDAMENTO FORÇADO COM CONFLITO]'
        ELSE 
          p_observacoes 
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
      CASE 
        WHEN p_force_conflict THEN 
          COALESCE(p_observacoes, '') || ' [AGENDAMENTO FORÇADO COM CONFLITO]'
        ELSE 
          p_observacoes 
      END,
      v_criado_por_nome, p_criado_por_user_id, 'agendado'
    ) RETURNING id INTO v_agendamento_id;
  END IF;
  
  -- Retornar sucesso com warnings se houver
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
      ELSE 'Agendamento criado com sucesso' 
    END
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erro interno: ' || SQLERRM);
END;
$function$;