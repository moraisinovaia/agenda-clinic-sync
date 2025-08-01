-- Corrigir função criar_agendamento_atomico para usar warnings ao invés de exceptions para validações de idade e convênio
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
AS $function$
DECLARE
  v_paciente_id UUID;
  v_agendamento_id UUID;
  v_doctor_record RECORD;
  v_patient_age INTEGER;
  v_conflict_check INTEGER;
  v_blocked_check INTEGER;
  v_result JSON;
  v_criado_por_nome TEXT;
  current_time_brazil TIMESTAMP WITH TIME ZONE;
  appointment_datetime TIMESTAMP WITH TIME ZONE;
  v_existing_patient_record RECORD;
  v_is_editing BOOLEAN := p_agendamento_id_edicao IS NOT NULL;
  v_warnings TEXT[] := '{}'; -- Array para coletar warnings
BEGIN
  -- Obter horário atual no Brasil (America/Sao_Paulo)
  current_time_brazil := now() AT TIME ZONE 'America/Sao_Paulo';
  
  -- Converter data/hora do agendamento para o timezone do Brasil
  appointment_datetime := (p_data_agendamento::text || ' ' || p_hora_agendamento::text)::timestamp AT TIME ZONE 'America/Sao_Paulo';

  -- Buscar nome real do usuário se temos o user_id
  IF p_criado_por_user_id IS NOT NULL THEN
    SELECT nome INTO v_criado_por_nome
    FROM public.profiles 
    WHERE user_id = p_criado_por_user_id
    LIMIT 1;
    
    v_criado_por_nome := COALESCE(v_criado_por_nome, p_criado_por);
  ELSE
    v_criado_por_nome := p_criado_por;
  END IF;

  -- Se estamos editando, buscar o paciente do agendamento existente
  IF v_is_editing THEN
    SELECT paciente_id INTO v_paciente_id
    FROM public.agendamentos 
    WHERE id = p_agendamento_id_edicao;
    
    IF v_paciente_id IS NULL THEN
      RAISE EXCEPTION 'Agendamento não encontrado para edição';
    END IF;
    
    -- Atualizar dados do paciente existente
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
    -- Bloquear o horário específico para evitar conflitos (apenas para novos agendamentos)
    PERFORM 1 FROM public.agendamentos 
    WHERE medico_id = p_medico_id 
      AND data_agendamento = p_data_agendamento 
      AND hora_agendamento = p_hora_agendamento
    FOR UPDATE;
    
    -- Buscar paciente existente ou criar novo
    SELECT * INTO v_existing_patient_record
    FROM public.pacientes
    WHERE LOWER(nome_completo) = LOWER(p_nome_completo)
      AND data_nascimento = p_data_nascimento
      AND convenio = p_convenio
    LIMIT 1;
    
    IF v_existing_patient_record.id IS NOT NULL THEN
      v_paciente_id := v_existing_patient_record.id;
      
      -- Se forçar atualização ou dados diferentes, atualizar
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
      -- Criar novo paciente
      INSERT INTO public.pacientes (
        nome_completo,
        data_nascimento,
        convenio,
        telefone,
        celular
      ) VALUES (
        p_nome_completo,
        p_data_nascimento,
        p_convenio,
        p_telefone,
        COALESCE(p_celular, '')
      ) RETURNING id INTO v_paciente_id;
    END IF;
  END IF;
  
  -- Verificar se médico está ativo e buscar suas restrições
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
  
  -- Verificar bloqueios de agenda (AINDA BLOQUEIA)
  SELECT COUNT(*)
  INTO v_blocked_check
  FROM public.bloqueios_agenda
  WHERE medico_id = p_medico_id
    AND status = 'ativo'
    AND p_data_agendamento BETWEEN data_inicio AND data_fim;
  
  IF v_blocked_check > 0 THEN
    RAISE EXCEPTION 'A agenda está bloqueada nesta data';
  END IF;
  
  -- Verificar conflito de horário (AINDA BLOQUEIA)
  SELECT COUNT(*)
  INTO v_conflict_check
  FROM public.agendamentos
  WHERE medico_id = p_medico_id
    AND data_agendamento = p_data_agendamento
    AND hora_agendamento = p_hora_agendamento
    AND status IN ('agendado', 'confirmado')
    AND id != COALESCE(p_agendamento_id_edicao, '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF v_conflict_check > 0 THEN
    RAISE EXCEPTION 'Este horário já está ocupado para o médico selecionado';
  END IF;
  
  -- Validar data/hora não é no passado (AINDA BLOQUEIA - mas só para novos agendamentos)
  IF appointment_datetime < (current_time_brazil + interval '1 hour') AND NOT v_is_editing THEN
    RAISE EXCEPTION 'Agendamento deve ser feito com pelo menos 1 hora de antecedência. Horário atual do Brasil: % - Agendamento solicitado: %', 
      to_char(current_time_brazil, 'DD/MM/YYYY HH24:MI'), 
      to_char(appointment_datetime, 'DD/MM/YYYY HH24:MI');
  END IF;
  
  -- Calcular idade do paciente
  SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_data_nascimento))::INTEGER
  INTO v_patient_age;
  
  -- ✅ AGORA SÃO WARNINGS: Validar idade vs médico (NÃO MAIS BLOQUEIA)
  IF v_doctor_record.idade_minima IS NOT NULL AND v_patient_age < v_doctor_record.idade_minima THEN
    v_warnings := array_append(v_warnings, 
      'ATENÇÃO: Paciente com ' || v_patient_age || ' anos está abaixo da idade mínima (' || v_doctor_record.idade_minima || ' anos) para este médico');
  END IF;
  
  IF v_doctor_record.idade_maxima IS NOT NULL AND v_patient_age > v_doctor_record.idade_maxima THEN
    v_warnings := array_append(v_warnings, 
      'ATENÇÃO: Paciente com ' || v_patient_age || ' anos está acima da idade máxima (' || v_doctor_record.idade_maxima || ' anos) para este médico');
  END IF;
  
  -- ✅ AGORA É WARNING: Validar convênio aceito (NÃO MAIS BLOQUEIA)
  IF v_doctor_record.convenios_aceitos IS NOT NULL AND 
     array_length(v_doctor_record.convenios_aceitos, 1) > 0 AND
     NOT (p_convenio = ANY(v_doctor_record.convenios_aceitos)) THEN
    v_warnings := array_append(v_warnings, 
      'ATENÇÃO: Convênio "' || p_convenio || '" pode não ser aceito por este médico');
  END IF;
  
  -- Criar ou atualizar agendamento
  IF v_is_editing THEN
    -- Atualizar agendamento existente
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
    -- Criar novo agendamento
    INSERT INTO public.agendamentos (
      paciente_id,
      medico_id,
      atendimento_id,
      data_agendamento,
      hora_agendamento,
      convenio,
      observacoes,
      criado_por,
      criado_por_user_id,
      status
    ) VALUES (
      v_paciente_id,
      p_medico_id,
      p_atendimento_id,
      p_data_agendamento,
      p_hora_agendamento,
      p_convenio,
      p_observacoes,
      v_criado_por_nome,
      p_criado_por_user_id,
      'agendado'
    ) RETURNING id INTO v_agendamento_id;
  END IF;
  
  -- Retornar dados do agendamento com warnings
  SELECT json_build_object(
    'success', true,
    'agendamento_id', v_agendamento_id,
    'paciente_id', v_paciente_id,
    'criado_por_usado', v_criado_por_nome,
    'is_editing', v_is_editing,
    'warnings', CASE WHEN array_length(v_warnings, 1) > 0 THEN v_warnings ELSE NULL END,
    'message', CASE WHEN v_is_editing THEN 'Agendamento atualizado com sucesso' ELSE 'Agendamento criado com sucesso' END
  ) INTO v_result;
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Em caso de erro, a transação será automaticamente revertida
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Erro ao processar agendamento: ' || SQLERRM
    );
END;
$function$;