-- Normalizar comparação de convênio também na função interna criar_agendamento_atomico
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
  p_force_conflict boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_paciente_id UUID;
  v_agendamento_id UUID;
  v_conflict_check INTEGER;
  v_doctor_record RECORD;
  v_patient_age INTEGER;
  v_blocked_check INTEGER;
  v_result JSON;
  v_age_note TEXT := '';
  v_cliente_id UUID;
  v_convenio_normalizado TEXT;
BEGIN
  -- Obter cliente_id do usuário autenticado
  v_cliente_id := get_user_cliente_id();
  
  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem cliente_id definido - contacte o administrador';
  END IF;

  IF p_medico_id IS NULL THEN
    RAISE EXCEPTION 'Médico é obrigatório';
  END IF;

  IF p_atendimento_id IS NULL THEN
    RAISE EXCEPTION 'Atendimento é obrigatório';
  END IF;

  IF p_data_agendamento IS NULL OR p_hora_agendamento IS NULL THEN
    RAISE EXCEPTION 'Data e hora são obrigatórias';
  END IF;

  -- Buscar médico
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

  -- Verificar bloqueios
  SELECT COUNT(*)
  INTO v_blocked_check
  FROM public.bloqueios_agenda
  WHERE medico_id = p_medico_id
    AND status = 'ativo'
    AND p_data_agendamento BETWEEN data_inicio AND data_fim;

  IF v_blocked_check > 0 THEN
    RAISE EXCEPTION 'A agenda está bloqueada nesta data';
  END IF;

  -- Validar que não é data/hora passada
  IF (p_data_agendamento::timestamp + p_hora_agendamento) < (now() - interval '1 hour') THEN
    RAISE EXCEPTION 'Não é possível agendar para uma data/hora que já passou';
  END IF;

  -- 🔎 NOVO: normalizar convênio para comparação (mesma lógica da função externa)
  v_convenio_normalizado := regexp_replace(upper(trim(p_convenio)), '[^A-Z0-9%]+', '', 'g');

  IF v_doctor_record.convenios_aceitos IS NOT NULL AND 
     array_length(v_doctor_record.convenios_aceitos, 1) > 0 THEN
    
    IF NOT EXISTS (
      SELECT 1
      FROM unnest(v_doctor_record.convenios_aceitos) AS convenio
      WHERE regexp_replace(upper(trim(convenio)), '[^A-Z0-9%]+', '', 'g') = v_convenio_normalizado
    ) THEN
      RAISE EXCEPTION 'Convênio "%" não é aceito por este médico', p_convenio;
    END IF;
  END IF;

  -- Calcular idade do paciente
  SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_data_nascimento))::INTEGER
  INTO v_patient_age;

  IF v_doctor_record.idade_minima IS NOT NULL AND v_patient_age < v_doctor_record.idade_minima THEN
    v_age_note := v_age_note || format(' [Idade %s anos - abaixo do padrão %s anos]', v_patient_age, v_doctor_record.idade_minima);
  END IF;

  IF v_doctor_record.idade_maxima IS NOT NULL AND v_patient_age > v_doctor_record.idade_maxima THEN
    v_age_note := v_age_note || format(' [Idade %s anos - acima do padrão %s anos]', v_patient_age, v_doctor_record.idade_maxima);
  END IF;

  -- Buscar paciente COM filtro de cliente_id
  SELECT id INTO v_paciente_id
  FROM public.pacientes
  WHERE LOWER(TRIM(nome_completo)) = LOWER(TRIM(p_nome_completo))
    AND data_nascimento = p_data_nascimento
    AND convenio = p_convenio
    AND cliente_id = v_cliente_id
  LIMIT 1;

  -- Criar paciente COM cliente_id
  IF v_paciente_id IS NULL THEN
    INSERT INTO public.pacientes (
      nome_completo, data_nascimento, convenio, telefone, celular, cliente_id
    ) VALUES (
      UPPER(TRIM(p_nome_completo)), p_data_nascimento, p_convenio, p_telefone, COALESCE(p_celular, ''), v_cliente_id
    ) RETURNING id INTO v_paciente_id;
  END IF;

  -- Edição de agendamento existente
  IF p_agendamento_id_edicao IS NOT NULL THEN
    UPDATE public.agendamentos
    SET
      paciente_id = v_paciente_id,
      medico_id = p_medico_id,
      atendimento_id = p_atendimento_id,
      data_agendamento = p_data_agendamento,
      hora_agendamento = p_hora_agendamento,
      convenio = p_convenio,
      observacoes = COALESCE(p_observacoes, '') || COALESCE(v_age_note, ''),
      alterado_por_user_id = p_criado_por_user_id,
      updated_at = NOW()
    WHERE id = p_agendamento_id_edicao
    RETURNING id INTO v_agendamento_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Agendamento não encontrado para edição';
    END IF;
  ELSE
    -- Criação de novo agendamento
    INSERT INTO public.agendamentos (
      paciente_id, medico_id, atendimento_id, data_agendamento, hora_agendamento,
      convenio, observacoes, criado_por, criado_por_user_id, status, cliente_id
    ) VALUES (
      v_paciente_id, p_medico_id, p_atendimento_id, p_data_agendamento, p_hora_agendamento,
      p_convenio, COALESCE(p_observacoes, '') || COALESCE(v_age_note, ''), p_criado_por, p_criado_por_user_id, 'agendado', v_cliente_id
    ) RETURNING id INTO v_agendamento_id;
  END IF;

  -- Montar resultado
  SELECT json_build_object(
    'success', true,
    'agendamento_id', v_agendamento_id,
    'paciente_id', v_paciente_id,
    'message', CASE WHEN v_age_note != '' THEN 
      'Agendamento criado com observações de idade' 
    ELSE 
      'Agendamento criado com sucesso' 
    END
  ) INTO v_result;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Erro ao criar agendamento: ' || SQLERRM
    );
END;
$function$;