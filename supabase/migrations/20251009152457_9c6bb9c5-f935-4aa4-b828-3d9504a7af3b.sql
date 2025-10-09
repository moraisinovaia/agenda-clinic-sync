-- Remover validação que exige horários vazios obrigatórios
-- Isso permitirá agendamento em qualquer horário livre, independente de horários vazios cadastrados

CREATE OR REPLACE FUNCTION public.criar_agendamento_atomico(
  p_nome_completo TEXT,
  p_data_nascimento DATE,
  p_convenio TEXT,
  p_telefone TEXT,
  p_celular TEXT,
  p_medico_id UUID,
  p_atendimento_id UUID,
  p_data_agendamento DATE,
  p_hora_agendamento TIME,
  p_observacoes TEXT DEFAULT NULL,
  p_criado_por TEXT DEFAULT 'recepcionista',
  p_criado_por_user_id UUID DEFAULT NULL,
  p_agendamento_id_edicao UUID DEFAULT NULL,
  p_forcar_conflito BOOLEAN DEFAULT FALSE
) RETURNS JSON AS $$
DECLARE
  v_paciente_id UUID;
  v_agendamento_id UUID;
  v_cliente_id_final UUID;
  v_horario_vazio_id UUID;
  v_is_editing BOOLEAN := FALSE;
  v_old_data_agendamento DATE;
  v_old_hora_agendamento TIME;
  v_conflict_check RECORD;
BEGIN
  -- Determinar cliente_id
  SELECT cliente_id INTO v_cliente_id_final
  FROM public.profiles
  WHERE user_id = COALESCE(p_criado_por_user_id, auth.uid())
  LIMIT 1;

  IF v_cliente_id_final IS NULL THEN
    SELECT id INTO v_cliente_id_final FROM public.clientes WHERE nome = 'IPADO' LIMIT 1;
    IF v_cliente_id_final IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Cliente não encontrado');
    END IF;
  END IF;

  -- Verificar se é edição
  IF p_agendamento_id_edicao IS NOT NULL THEN
    v_is_editing := TRUE;
    SELECT data_agendamento, hora_agendamento 
    INTO v_old_data_agendamento, v_old_hora_agendamento
    FROM public.agendamentos 
    WHERE id = p_agendamento_id_edicao;
  END IF;

  -- Tentar reservar horário vazio (se existir)
  BEGIN
    UPDATE public.horarios_vazios
    SET status = 'reservado', updated_at = now()
    WHERE medico_id = p_medico_id
      AND data = p_data_agendamento
      AND hora = p_hora_agendamento
      AND status = 'disponivel'
      AND cliente_id = v_cliente_id_final
    RETURNING id INTO v_horario_vazio_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'SLOT_RESERVATION_FAILED',
      'message', 'Outro usuário está reservando este horário. Tente novamente.'
    );
  END;
  
  -- ✅ CORREÇÃO: Remover validação que exige horário vazio
  -- Agora permite agendamento em qualquer horário, mesmo sem horário vazio cadastrado
  -- A única validação necessária é de conflito com outro agendamento
  
  -- Verificar conflitos de horário (somente se não for edição ou se mudou o horário)
  IF (NOT v_is_editing OR (v_old_data_agendamento != p_data_agendamento OR v_old_hora_agendamento != p_hora_agendamento)) 
     AND p_forcar_conflito = false THEN
    
    SELECT a.id, p_nome.nome_completo as paciente_nome, a.status
    INTO v_conflict_check
    FROM public.agendamentos a
    JOIN public.pacientes p_nome ON a.paciente_id = p_nome.id
    WHERE a.medico_id = p_medico_id
      AND a.data_agendamento = p_data_agendamento
      AND a.hora_agendamento = p_hora_agendamento
      AND a.status IN ('agendado', 'confirmado')
      AND (p_agendamento_id_edicao IS NULL OR a.id != p_agendamento_id_edicao)
      AND a.cliente_id = v_cliente_id_final
    LIMIT 1;

    IF FOUND THEN
      -- Liberar horário vazio se foi reservado
      IF v_horario_vazio_id IS NOT NULL THEN
        UPDATE public.horarios_vazios SET status = 'disponivel', updated_at = now() WHERE id = v_horario_vazio_id;
      END IF;
      
      RETURN json_build_object(
        'success', false,
        'error', 'TIME_CONFLICT',
        'message', 'Já existe um agendamento neste horário',
        'conflict_detected', true,
        'conflict_details', json_build_object(
          'agendamento_id', v_conflict_check.id,
          'paciente_nome', v_conflict_check.paciente_nome,
          'status', v_conflict_check.status
        )
      );
    END IF;
  END IF;

  -- Buscar ou criar paciente
  SELECT id INTO v_paciente_id
  FROM public.pacientes
  WHERE LOWER(TRIM(nome_completo)) = LOWER(TRIM(p_nome_completo))
    AND data_nascimento = p_data_nascimento
    AND cliente_id = v_cliente_id_final
  LIMIT 1;

  IF v_paciente_id IS NULL THEN
    INSERT INTO public.pacientes (nome_completo, data_nascimento, convenio, telefone, celular, cliente_id)
    VALUES (TRIM(p_nome_completo), p_data_nascimento, p_convenio, p_telefone, COALESCE(p_celular, ''), v_cliente_id_final)
    RETURNING id INTO v_paciente_id;
  END IF;

  -- Criar ou atualizar agendamento
  IF v_is_editing THEN
    UPDATE public.agendamentos
    SET 
      paciente_id = v_paciente_id,
      medico_id = p_medico_id,
      atendimento_id = p_atendimento_id,
      data_agendamento = p_data_agendamento,
      hora_agendamento = p_hora_agendamento,
      convenio = p_convenio,
      observacoes = COALESCE(p_observacoes, ''),
      alterado_por_user_id = COALESCE(p_criado_por_user_id, auth.uid()),
      updated_at = now()
    WHERE id = p_agendamento_id_edicao
    RETURNING id INTO v_agendamento_id;
  ELSE
    INSERT INTO public.agendamentos (
      paciente_id, medico_id, atendimento_id, data_agendamento, hora_agendamento,
      convenio, observacoes, criado_por, criado_por_user_id, status, cliente_id
    ) VALUES (
      v_paciente_id, p_medico_id, p_atendimento_id, p_data_agendamento, p_hora_agendamento,
      p_convenio, COALESCE(p_observacoes, ''), p_criado_por, p_criado_por_user_id, 'agendado', v_cliente_id_final
    ) RETURNING id INTO v_agendamento_id;
  END IF;

  -- Marcar horário vazio como ocupado (se existir)
  IF v_horario_vazio_id IS NOT NULL THEN
    UPDATE public.horarios_vazios
    SET status = 'ocupado', updated_at = now()
    WHERE id = v_horario_vazio_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'agendamento_id', v_agendamento_id,
    'paciente_id', v_paciente_id,
    'message', CASE WHEN v_is_editing THEN 'Agendamento atualizado com sucesso' ELSE 'Agendamento criado com sucesso' END,
    'is_editing', v_is_editing,
    'horario_vazio_usado', v_horario_vazio_id IS NOT NULL
  );

EXCEPTION
  WHEN OTHERS THEN
    IF v_horario_vazio_id IS NOT NULL THEN
      UPDATE public.horarios_vazios SET status = 'disponivel', updated_at = now() WHERE id = v_horario_vazio_id;
    END IF;
    RETURN json_build_object('success', false, 'error', SQLERRM, 'message', 'Erro ao criar agendamento: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;