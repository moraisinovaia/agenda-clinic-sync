-- Atualizar a função criar_agendamento_atomico para suportar data_nascimento NULL
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
  p_criado_por text DEFAULT 'recepcionista'::text, 
  p_criado_por_user_id uuid DEFAULT NULL::uuid, 
  p_agendamento_id_edicao uuid DEFAULT NULL::uuid, 
  p_forcar_conflito boolean DEFAULT false
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_paciente_id UUID;
  v_agendamento_id UUID;
  v_doctor_record RECORD;
  v_patient_age INTEGER;
  v_blocked_check INTEGER;
  v_conflict_check INTEGER;
  v_result JSON;
  v_age_note TEXT := '';
  v_cliente_id_final UUID;
  v_is_editing BOOLEAN := false;
  v_is_dr_marcelo BOOLEAN := false;
BEGIN
  -- Determinar cliente_id do usuário atual
  SELECT cliente_id INTO v_cliente_id_final 
  FROM public.profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;
  
  -- Se não encontrou, usar cliente padrão IPADO
  IF v_cliente_id_final IS NULL THEN
    SELECT id INTO v_cliente_id_final 
    FROM public.clientes 
    WHERE nome = 'IPADO' 
    LIMIT 1;
  END IF;

  -- Verificar se é edição
  IF p_agendamento_id_edicao IS NOT NULL THEN
    v_is_editing := true;
  END IF;
  
  -- Verificar se é médico Dr. Marcelo
  v_is_dr_marcelo := p_medico_id IN (
    '1e110923-50df-46ff-a57a-29d88e372900'::uuid, -- Dr. Marcelo D'Carli
    'e6453b94-840d-4adf-ab0f-fc22be7cd7f5'::uuid, -- MAPA - Dr. Marcelo  
    '9d5d0e63-098b-4282-aa03-db3c7e012579'::uuid  -- Teste Ergométrico - Dr. Marcelo
  );
  
  -- Validações básicas
  IF p_nome_completo IS NULL OR TRIM(p_nome_completo) = '' THEN
    RAISE EXCEPTION 'Nome do paciente é obrigatório';
  END IF;
  
  -- Validar data de nascimento apenas se não for Dr. Marcelo
  IF NOT v_is_dr_marcelo AND p_data_nascimento IS NULL THEN
    RAISE EXCEPTION 'Data de nascimento é obrigatória para este médico';
  END IF;
  
  IF p_convenio IS NULL OR TRIM(p_convenio) = '' THEN
    RAISE EXCEPTION 'Convênio é obrigatório';
  END IF;
  
  IF p_celular IS NULL OR TRIM(p_celular) = '' THEN
    RAISE EXCEPTION 'Celular é obrigatório';
  END IF;
  
  -- Buscar dados do médico
  SELECT m.*, m.ativo, m.idade_minima, m.idade_maxima, m.convenios_aceitos
  INTO v_doctor_record
  FROM public.medicos m
  WHERE m.id = p_medico_id AND m.cliente_id = v_cliente_id_final;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Médico não encontrado para esta clínica';
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
    AND p_data_agendamento BETWEEN data_inicio AND data_fim
    AND cliente_id = v_cliente_id_final;
  
  IF v_blocked_check > 0 THEN
    RAISE EXCEPTION 'A agenda está bloqueada nesta data';
  END IF;
  
  -- Validar data/hora futura (com tolerância de 1 hora)
  IF (p_data_agendamento::timestamp + p_hora_agendamento) < (now() + interval '1 hour') THEN
    RAISE EXCEPTION 'Não é possível agendar para uma data/hora que já passou ou é muito próxima (mínimo 1 hora de antecedência)';
  END IF;
  
  -- Calcular idade do paciente apenas se tiver data de nascimento
  IF p_data_nascimento IS NOT NULL THEN
    SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_data_nascimento))::INTEGER
    INTO v_patient_age;
    
    -- Verificar restrições de idade apenas se não for Dr. Marcelo
    IF NOT v_is_dr_marcelo THEN
      IF v_doctor_record.idade_minima IS NOT NULL AND v_patient_age < v_doctor_record.idade_minima THEN
        v_age_note := v_age_note || format(' [Idade %s anos - abaixo do padrão %s anos]', v_patient_age, v_doctor_record.idade_minima);
      END IF;
      
      IF v_doctor_record.idade_maxima IS NOT NULL AND v_patient_age > v_doctor_record.idade_maxima THEN
        v_age_note := v_age_note || format(' [Idade %s anos - acima do padrão %s anos]', v_patient_age, v_doctor_record.idade_maxima);
      END IF;
    END IF;
  END IF;

  -- Verificar convênios aceitos
  IF v_doctor_record.convenios_aceitos IS NOT NULL AND 
     array_length(v_doctor_record.convenios_aceitos, 1) > 0 AND
     NOT (p_convenio = ANY(v_doctor_record.convenios_aceitos)) THEN
    RAISE EXCEPTION 'Convênio "%" não é aceito por este médico', p_convenio;
  END IF;
  
  -- Verificar conflitos de horário (se não for edição ou se mudou horário na edição)
  IF NOT v_is_editing AND p_forcar_conflito = false THEN
    SELECT COUNT(*)
    INTO v_conflict_check
    FROM public.agendamentos a
    WHERE a.medico_id = p_medico_id
      AND a.data_agendamento = p_data_agendamento
      AND a.hora_agendamento = p_hora_agendamento
      AND a.status IN ('agendado', 'confirmado')
      AND a.cliente_id = v_cliente_id_final
      AND a.id != COALESCE(p_agendamento_id_edicao, '00000000-0000-0000-0000-000000000000'::uuid);
      
    IF v_conflict_check > 0 THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Conflito de horário detectado',
        'conflict_detected', true,
        'message', 'Este horário já está ocupado. Use forcar_conflito=true para sobrescrever.',
        'conflict_details', json_build_object(
          'medico_id', p_medico_id,
          'data', p_data_agendamento,
          'hora', p_hora_agendamento
        )
      );
    END IF;
  END IF;
  
  -- Buscar ou criar paciente
  -- Para Dr. Marcelo, buscar considerando data_nascimento NULL
  IF v_is_dr_marcelo THEN
    SELECT id INTO v_paciente_id
    FROM public.pacientes
    WHERE LOWER(nome_completo) = LOWER(p_nome_completo)
      AND convenio = p_convenio
      AND cliente_id = v_cliente_id_final
      AND (
        (p_data_nascimento IS NULL AND data_nascimento IS NULL) OR
        (p_data_nascimento IS NOT NULL AND data_nascimento = p_data_nascimento)
      )
    LIMIT 1;
  ELSE
    -- Para outros médicos, buscar com data_nascimento obrigatória
    SELECT id INTO v_paciente_id
    FROM public.pacientes
    WHERE LOWER(nome_completo) = LOWER(p_nome_completo)
      AND data_nascimento = p_data_nascimento
      AND convenio = p_convenio
      AND cliente_id = v_cliente_id_final
    LIMIT 1;
  END IF;
  
  IF v_paciente_id IS NULL THEN
    INSERT INTO public.pacientes (
      nome_completo, data_nascimento, convenio, telefone, celular, cliente_id
    ) VALUES (
      p_nome_completo, p_data_nascimento, p_convenio, p_telefone, COALESCE(p_celular, ''), v_cliente_id_final
    ) RETURNING id INTO v_paciente_id;
  ELSE
    -- Atualizar dados do paciente se necessário
    UPDATE public.pacientes 
    SET 
      telefone = COALESCE(p_telefone, telefone),
      celular = COALESCE(p_celular, celular),
      data_nascimento = COALESCE(p_data_nascimento, data_nascimento),
      updated_at = now()
    WHERE id = v_paciente_id;
  END IF;
  
  -- Criar ou atualizar agendamento
  IF v_is_editing THEN
    -- Atualizar agendamento existente
    UPDATE public.agendamentos 
    SET 
      paciente_id = v_paciente_id,
      medico_id = p_medico_id,
      atendimento_id = p_atendimento_id,
      data_agendamento = p_data_agendamento,
      hora_agendamento = p_hora_agendamento,
      convenio = p_convenio,
      observacoes = COALESCE(p_observacoes, '') || COALESCE(v_age_note, ''),
      updated_at = now()
    WHERE id = p_agendamento_id_edicao
      AND cliente_id = v_cliente_id_final
    RETURNING id INTO v_agendamento_id;
    
    IF v_agendamento_id IS NULL THEN
      RAISE EXCEPTION 'Agendamento para edição não encontrado ou não pertence à sua clínica';
    END IF;
  ELSE
    -- Criar novo agendamento
    INSERT INTO public.agendamentos (
      paciente_id, medico_id, atendimento_id, data_agendamento, hora_agendamento,
      convenio, observacoes, criado_por, criado_por_user_id, status, cliente_id
    ) VALUES (
      v_paciente_id, p_medico_id, p_atendimento_id, p_data_agendamento, p_hora_agendamento,
      p_convenio, COALESCE(p_observacoes, '') || COALESCE(v_age_note, ''), 
      p_criado_por, p_criado_por_user_id, 'agendado', v_cliente_id_final
    ) RETURNING id INTO v_agendamento_id;
  END IF;
  
  -- Retornar resultado de sucesso
  SELECT json_build_object(
    'success', true,
    'agendamento_id', v_agendamento_id,
    'paciente_id', v_paciente_id,
    'cliente_id', v_cliente_id_final,
    'is_editing', v_is_editing,
    'message', CASE 
      WHEN v_is_editing THEN 'Agendamento editado com sucesso'
      WHEN v_age_note <> '' THEN 'Agendamento criado com observações de idade' 
      ELSE 'Agendamento criado com sucesso' 
    END,
    'warnings', CASE WHEN v_age_note <> '' THEN ARRAY[v_age_note] ELSE ARRAY[]::text[] END,
    'criado_por_usado', p_criado_por
  ) INTO v_result;
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Erro ao processar agendamento: ' || SQLERRM,
      'is_editing', v_is_editing
    );
END;
$function$;