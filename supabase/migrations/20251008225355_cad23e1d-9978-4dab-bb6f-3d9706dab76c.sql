-- ============================================================================
-- CORREÇÃO COMPLETA DA FUNÇÃO criar_agendamento_atomico
-- ============================================================================

-- 1. DROP da função antiga
DROP FUNCTION IF EXISTS public.criar_agendamento_atomico(text, date, text, text, text, uuid, uuid, date, time, text, text, uuid, uuid, boolean);

-- 2. CRIAR FUNÇÃO CORRIGIDA com todas as validações
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
)
RETURNS json
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
  v_horario_vazio_id UUID;
  v_current_time_brazil TIMESTAMP WITH TIME ZONE;
  v_appointment_datetime TIMESTAMP WITH TIME ZONE;
  v_dia_semana INTEGER;
  v_horario_valido BOOLEAN := false;
  v_old_data_agendamento DATE;
  v_old_hora_agendamento TIME;
BEGIN
  -- Obter horário atual no Brasil
  v_current_time_brazil := now() AT TIME ZONE 'America/Sao_Paulo';
  
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

  -- Verificar se é edição e armazenar horário antigo
  IF p_agendamento_id_edicao IS NOT NULL THEN
    v_is_editing := true;
    
    SELECT data_agendamento, hora_agendamento 
    INTO v_old_data_agendamento, v_old_hora_agendamento
    FROM public.agendamentos
    WHERE id = p_agendamento_id_edicao AND cliente_id = v_cliente_id_final;
    
    IF NOT FOUND THEN
      RETURN json_build_object(
        'success', false,
        'error', 'APPOINTMENT_NOT_FOUND',
        'message', 'Agendamento não encontrado ou não pertence à sua clínica'
      );
    END IF;
  END IF;
  
  -- Verificar se é médico Dr. Marcelo
  v_is_dr_marcelo := p_medico_id IN (
    '1e110923-50df-46ff-a57a-29d88e372900'::uuid,
    'e6453b94-840d-4adf-ab0f-fc22be7cd7f5'::uuid,
    '9d5d0e63-098b-4282-aa03-db3c7e012579'::uuid
  );
  
  -- Validações básicas
  IF p_nome_completo IS NULL OR TRIM(p_nome_completo) = '' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'INVALID_NAME',
      'message', 'Nome do paciente é obrigatório'
    );
  END IF;
  
  IF NOT v_is_dr_marcelo AND p_data_nascimento IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'INVALID_BIRTHDATE',
      'message', 'Data de nascimento é obrigatória para este médico'
    );
  END IF;
  
  IF p_convenio IS NULL OR TRIM(p_convenio) = '' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'INVALID_INSURANCE',
      'message', 'Convênio é obrigatório'
    );
  END IF;
  
  IF p_celular IS NULL OR TRIM(p_celular) = '' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'INVALID_PHONE',
      'message', 'Celular é obrigatório'
    );
  END IF;
  
  -- Buscar dados do médico com lock
  SELECT m.* INTO v_doctor_record
  FROM public.medicos m
  WHERE m.id = p_medico_id AND m.cliente_id = v_cliente_id_final
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'DOCTOR_NOT_FOUND',
      'message', 'Médico não encontrado para esta clínica'
    );
  END IF;
  
  IF NOT v_doctor_record.ativo THEN
    RETURN json_build_object(
      'success', false,
      'error', 'DOCTOR_INACTIVE',
      'message', 'Médico não está ativo'
    );
  END IF;
  
  -- Verificar bloqueios de agenda
  SELECT COUNT(*) INTO v_blocked_check
  FROM public.bloqueios_agenda
  WHERE medico_id = p_medico_id
    AND status = 'ativo'
    AND p_data_agendamento BETWEEN data_inicio AND data_fim
    AND cliente_id = v_cliente_id_final;
  
  IF v_blocked_check > 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'AGENDA_BLOCKED',
      'message', 'A agenda está bloqueada nesta data'
    );
  END IF;
  
  -- Validar data/hora futura com timezone correto
  v_appointment_datetime := (p_data_agendamento::text || ' ' || p_hora_agendamento::text)::timestamp AT TIME ZONE 'America/Sao_Paulo';
  
  IF v_appointment_datetime < (v_current_time_brazil + interval '1 hour') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'INVALID_DATETIME',
      'message', 'Não é possível agendar para uma data/hora que já passou ou é muito próxima (mínimo 1 hora de antecedência)'
    );
  END IF;
  
  -- Calcular dia da semana (0=Domingo, 6=Sábado)
  v_dia_semana := EXTRACT(DOW FROM p_data_agendamento);
  
  -- Validar se existe configuração de horário para este dia/médico
  SELECT EXISTS (
    SELECT 1 FROM public.horarios_configuracao
    WHERE medico_id = p_medico_id
      AND cliente_id = v_cliente_id_final
      AND dia_semana = v_dia_semana
      AND ativo = true
      AND p_hora_agendamento >= hora_inicio
      AND p_hora_agendamento < hora_fim
  ) INTO v_horario_valido;
  
  -- Se não há configuração, permitir (retrocompatibilidade)
  IF NOT v_horario_valido THEN
    v_horario_valido := NOT EXISTS (
      SELECT 1 FROM public.horarios_configuracao 
      WHERE medico_id = p_medico_id AND cliente_id = v_cliente_id_final
    );
  END IF;
  
  IF NOT v_horario_valido THEN
    RETURN json_build_object(
      'success', false,
      'error', 'OUTSIDE_WORK_HOURS',
      'message', 'Horário fora do expediente do médico'
    );
  END IF;
  
  -- Calcular idade do paciente
  IF p_data_nascimento IS NOT NULL THEN
    SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_data_nascimento))::INTEGER INTO v_patient_age;
    
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
    RETURN json_build_object(
      'success', false,
      'error', 'INSURANCE_NOT_ACCEPTED',
      'message', format('Convênio "%s" não é aceito por este médico', p_convenio)
    );
  END IF;
  
  -- ===== VALIDAÇÃO CRÍTICA: HORÁRIO VAZIO DISPONÍVEL =====
  BEGIN
    SELECT id INTO v_horario_vazio_id
    FROM public.horarios_vazios
    WHERE medico_id = p_medico_id
      AND cliente_id = v_cliente_id_final
      AND data = p_data_agendamento
      AND hora = p_hora_agendamento
      AND status = 'disponivel'
    FOR UPDATE NOWAIT;
    
  EXCEPTION
    WHEN lock_not_available THEN
      RETURN json_build_object(
        'success', false,
        'error', 'CONCURRENT_BOOKING',
        'message', 'Outro usuário está reservando este horário. Tente novamente.'
      );
  END;
  
  -- Se não existe horário vazio, permitir apenas se não há sistema de horários vazios configurado
  IF v_horario_vazio_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.horarios_vazios WHERE medico_id = p_medico_id AND cliente_id = v_cliente_id_final LIMIT 1) THEN
      RETURN json_build_object(
        'success', false,
        'error', 'SLOT_NOT_AVAILABLE',
        'message', 'Este horário não está disponível. Consulte os horários vazios.',
        'slot_required', true
      );
    END IF;
  END IF;
  
  -- Verificar conflitos de horário (somente se não for edição ou se mudou o horário)
  IF (NOT v_is_editing OR (v_old_data_agendamento != p_data_agendamento OR v_old_hora_agendamento != p_hora_agendamento)) 
     AND p_forcar_conflito = false THEN
    
    SELECT COUNT(*) INTO v_conflict_check
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
        'error', 'TIME_CONFLICT',
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
  IF v_is_dr_marcelo THEN
    SELECT id INTO v_paciente_id
    FROM public.pacientes
    WHERE LOWER(nome_completo) = LOWER(p_nome_completo)
      AND convenio = p_convenio
      AND cliente_id = v_cliente_id_final
      AND ((p_data_nascimento IS NULL AND data_nascimento IS NULL) OR (p_data_nascimento IS NOT NULL AND data_nascimento = p_data_nascimento))
    LIMIT 1;
  ELSE
    SELECT id INTO v_paciente_id
    FROM public.pacientes
    WHERE LOWER(nome_completo) = LOWER(p_nome_completo)
      AND data_nascimento = p_data_nascimento
      AND convenio = p_convenio
      AND cliente_id = v_cliente_id_final
    LIMIT 1;
  END IF;
  
  IF v_paciente_id IS NULL THEN
    INSERT INTO public.pacientes (nome_completo, data_nascimento, convenio, telefone, celular, cliente_id)
    VALUES (p_nome_completo, p_data_nascimento, p_convenio, p_telefone, COALESCE(p_celular, ''), v_cliente_id_final)
    RETURNING id INTO v_paciente_id;
  ELSE
    UPDATE public.pacientes 
    SET telefone = COALESCE(p_telefone, telefone),
        celular = COALESCE(p_celular, celular),
        data_nascimento = COALESCE(p_data_nascimento, data_nascimento),
        updated_at = now()
    WHERE id = v_paciente_id;
  END IF;
  
  -- Criar ou atualizar agendamento
  IF v_is_editing THEN
    UPDATE public.agendamentos 
    SET paciente_id = v_paciente_id,
        medico_id = p_medico_id,
        atendimento_id = p_atendimento_id,
        data_agendamento = p_data_agendamento,
        hora_agendamento = p_hora_agendamento,
        convenio = p_convenio,
        observacoes = COALESCE(p_observacoes, '') || COALESCE(v_age_note, ''),
        updated_at = now()
    WHERE id = p_agendamento_id_edicao AND cliente_id = v_cliente_id_final
    RETURNING id INTO v_agendamento_id;
    
    IF v_agendamento_id IS NULL THEN
      RETURN json_build_object(
        'success', false,
        'error', 'APPOINTMENT_UPDATE_FAILED',
        'message', 'Falha ao atualizar agendamento'
      );
    END IF;
  ELSE
    INSERT INTO public.agendamentos (
      paciente_id, medico_id, atendimento_id, data_agendamento, hora_agendamento,
      convenio, observacoes, criado_por, criado_por_user_id, status, cliente_id
    ) VALUES (
      v_paciente_id, p_medico_id, p_atendimento_id, p_data_agendamento, p_hora_agendamento,
      p_convenio, COALESCE(p_observacoes, '') || COALESCE(v_age_note, ''), 
      p_criado_por, p_criado_por_user_id, 'agendado', v_cliente_id_final
    ) RETURNING id INTO v_agendamento_id;
  END IF;
  
  -- ===== ATUALIZAR HORÁRIO VAZIO PARA OCUPADO =====
  IF v_horario_vazio_id IS NOT NULL THEN
    UPDATE public.horarios_vazios
    SET status = 'ocupado', updated_at = now()
    WHERE id = v_horario_vazio_id;
  END IF;
  
  -- Retornar resultado de sucesso
  RETURN json_build_object(
    'success', true,
    'agendamento_id', v_agendamento_id,
    'paciente_id', v_paciente_id,
    'cliente_id', v_cliente_id_final,
    'is_editing', v_is_editing,
    'horario_vazio_atualizado', v_horario_vazio_id IS NOT NULL,
    'message', CASE 
      WHEN v_is_editing THEN 'Agendamento editado com sucesso'
      WHEN v_age_note <> '' THEN 'Agendamento criado com observações de idade' 
      ELSE 'Agendamento criado com sucesso' 
    END,
    'warnings', CASE WHEN v_age_note <> '' THEN ARRAY[v_age_note] ELSE ARRAY[]::text[] END,
    'criado_por_usado', p_criado_por
  );
  
END;
$function$;

-- ============================================================================
-- 3. TRIGGER: LIBERAR HORÁRIO AO CANCELAR/REALIZAR
-- ============================================================================

CREATE OR REPLACE FUNCTION public.liberar_horario_ao_cancelar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Se status mudou para 'cancelado' ou 'realizado', liberar horário vazio
  IF NEW.status IN ('cancelado', 'realizado') AND OLD.status NOT IN ('cancelado', 'realizado') THEN
    UPDATE public.horarios_vazios
    SET status = 'disponivel', updated_at = now()
    WHERE medico_id = OLD.medico_id
      AND cliente_id = OLD.cliente_id
      AND data = OLD.data_agendamento
      AND hora = OLD.hora_agendamento
      AND status = 'ocupado';
  END IF;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_liberar_horario ON public.agendamentos;
CREATE TRIGGER trigger_liberar_horario
  AFTER UPDATE OF status ON public.agendamentos
  FOR EACH ROW
  WHEN (NEW.status IN ('cancelado', 'realizado') AND OLD.status NOT IN ('cancelado', 'realizado'))
  EXECUTE FUNCTION public.liberar_horario_ao_cancelar();

-- ============================================================================
-- 4. TRIGGER: LIBERAR HORÁRIO ANTIGO AO REMARCAR
-- ============================================================================

CREATE OR REPLACE FUNCTION public.liberar_horario_ao_editar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Se data/hora mudou, liberar horário antigo
  IF (OLD.data_agendamento != NEW.data_agendamento OR OLD.hora_agendamento != NEW.hora_agendamento) THEN
    UPDATE public.horarios_vazios
    SET status = 'disponivel', updated_at = now()
    WHERE medico_id = OLD.medico_id
      AND cliente_id = OLD.cliente_id
      AND data = OLD.data_agendamento
      AND hora = OLD.hora_agendamento
      AND status = 'ocupado';
      
    -- Marcar novo horário como ocupado
    UPDATE public.horarios_vazios
    SET status = 'ocupado', updated_at = now()
    WHERE medico_id = NEW.medico_id
      AND cliente_id = NEW.cliente_id
      AND data = NEW.data_agendamento
      AND hora = NEW.hora_agendamento
      AND status = 'disponivel';
  END IF;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_liberar_horario_edicao ON public.agendamentos;
CREATE TRIGGER trigger_liberar_horario_edicao
  AFTER UPDATE OF data_agendamento, hora_agendamento ON public.agendamentos
  FOR EACH ROW
  WHEN (OLD.data_agendamento IS DISTINCT FROM NEW.data_agendamento OR OLD.hora_agendamento IS DISTINCT FROM NEW.hora_agendamento)
  EXECUTE FUNCTION public.liberar_horario_ao_editar();

-- ============================================================================
-- 5. ÍNDICES DE PERFORMANCE
-- ============================================================================

-- Índice composto para horarios_vazios (queries de disponibilidade)
CREATE INDEX IF NOT EXISTS idx_horarios_vazios_lookup 
ON public.horarios_vazios(medico_id, cliente_id, data, hora, status);

-- Índice composto para agendamentos (queries de conflito)
CREATE INDEX IF NOT EXISTS idx_agendamentos_lookup 
ON public.agendamentos(medico_id, cliente_id, data_agendamento, hora_agendamento, status);