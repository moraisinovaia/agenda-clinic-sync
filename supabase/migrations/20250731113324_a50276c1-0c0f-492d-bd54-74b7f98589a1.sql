-- Corrigir validação de conflito na função criar_agendamento_multiplo
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
AS $function$
DECLARE
  v_paciente_id UUID;
  v_agendamento_ids UUID[] := '{}';
  v_doctor_record RECORD;
  v_patient_age INTEGER;
  v_conflict_check INTEGER;
  v_blocked_check INTEGER;
  v_result JSON;
  v_atendimento_id UUID;
  v_current_agendamento_id UUID;
  v_combined_observations TEXT := '';
  v_atendimento_name TEXT;
  v_atendimento_names TEXT[] := '{}';
BEGIN
  -- Validar que há pelo menos um atendimento
  IF array_length(p_atendimento_ids, 1) IS NULL OR array_length(p_atendimento_ids, 1) = 0 THEN
    RAISE EXCEPTION 'É necessário selecionar pelo menos um atendimento';
  END IF;

  -- Buscar nomes dos atendimentos para observações
  FOR v_atendimento_id IN SELECT unnest(p_atendimento_ids)
  LOOP
    SELECT nome INTO v_atendimento_name FROM public.atendimentos WHERE id = v_atendimento_id;
    IF v_atendimento_name IS NOT NULL THEN
      v_atendimento_names := array_append(v_atendimento_names, v_atendimento_name);
    END IF;
  END LOOP;

  -- Criar observação combinada
  IF array_length(v_atendimento_names, 1) > 1 THEN
    v_combined_observations := 'Agendamento múltiplo: ' || array_to_string(v_atendimento_names, ' + ');
    IF p_observacoes IS NOT NULL AND trim(p_observacoes) != '' THEN
      v_combined_observations := v_combined_observations || '. ' || p_observacoes;
    END IF;
  ELSE
    v_combined_observations := p_observacoes;
  END IF;

  -- Bloquear o horário específico para evitar conflitos
  PERFORM 1 FROM public.agendamentos 
  WHERE medico_id = p_medico_id 
    AND data_agendamento = p_data_agendamento 
    AND hora_agendamento = p_hora_agendamento
  FOR UPDATE;
  
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
  
  -- VALIDAÇÃO CORRIGIDA: Verificar conflitos inteligentes para agendamentos múltiplos
  SELECT COUNT(*)
  INTO v_conflict_check
  FROM public.agendamentos a
  JOIN public.pacientes p ON a.paciente_id = p.id
  WHERE a.medico_id = p_medico_id
    AND a.data_agendamento = p_data_agendamento
    AND a.hora_agendamento = p_hora_agendamento
    AND a.status IN ('agendado', 'confirmado')
    AND (
      -- Bloquear apenas se é paciente diferente E não é agendamento múltiplo existente
      (LOWER(p.nome_completo) != LOWER(p_nome_completo) OR p.data_nascimento != p_data_nascimento)
      AND (a.observacoes IS NULL OR a.observacoes NOT ILIKE '%Agendamento múltiplo:%')
    );
  
  IF v_conflict_check > 0 THEN
    RAISE EXCEPTION 'Este horário já está ocupado por outro paciente';
  END IF;
  
  -- Validar data/hora não é no passado
  IF (p_data_agendamento::timestamp + p_hora_agendamento) < (now() - interval '1 hour') THEN
    RAISE EXCEPTION 'Não é possível agendar para uma data/hora que já passou';
  END IF;
  
  -- Calcular idade do paciente
  SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_data_nascimento))::INTEGER
  INTO v_patient_age;
  
  -- Validar idade vs médico
  IF v_doctor_record.idade_minima IS NOT NULL AND v_patient_age < v_doctor_record.idade_minima THEN
    RAISE EXCEPTION 'Paciente com % anos está abaixo da idade mínima (% anos) para este médico', 
      v_patient_age, v_doctor_record.idade_minima;
  END IF;
  
  IF v_doctor_record.idade_maxima IS NOT NULL AND v_patient_age > v_doctor_record.idade_maxima THEN
    RAISE EXCEPTION 'Paciente com % anos está acima da idade máxima (% anos) para este médico', 
      v_patient_age, v_doctor_record.idade_maxima;
  END IF;
  
  -- Validar convênio aceito
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
  
  -- Criar um agendamento para cada atendimento no mesmo horário
  FOR v_atendimento_id IN SELECT unnest(p_atendimento_ids)
  LOOP
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
      v_atendimento_id,
      p_data_agendamento,
      p_hora_agendamento,
      p_convenio,
      v_combined_observations,
      p_criado_por,
      p_criado_por_user_id,
      'agendado'
    ) RETURNING id INTO v_current_agendamento_id;
    
    v_agendamento_ids := array_append(v_agendamento_ids, v_current_agendamento_id);
  END LOOP;
  
  -- Retornar dados dos agendamentos criados
  SELECT json_build_object(
    'success', true,
    'agendamento_ids', v_agendamento_ids,
    'paciente_id', v_paciente_id,
    'total_agendamentos', array_length(v_agendamento_ids, 1),
    'atendimentos', v_atendimento_names,
    'message', 'Agendamento múltiplo criado com sucesso: ' || array_to_string(v_atendimento_names, ' + ')
  ) INTO v_result;
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Em caso de erro, a transação será automaticamente revertida
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Erro ao criar agendamento múltiplo: ' || SQLERRM
    );
END;
$function$;