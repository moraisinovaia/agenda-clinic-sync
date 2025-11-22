-- Drop and recreate the function with proper convenio normalization
DROP FUNCTION IF EXISTS public.criar_agendamento_atomico_externo(uuid,text,date,text,text,text,uuid,uuid,date,time without time zone,text,text,boolean);

CREATE OR REPLACE FUNCTION public.criar_agendamento_atomico_externo(
  p_cliente_id UUID,
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
  p_criado_por TEXT DEFAULT 'api_externa',
  p_force_conflict BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id UUID;
  v_agendamento_id UUID;
  v_conflict_check INTEGER;
  v_doctor_record RECORD;
  v_patient_age INTEGER;
  v_blocked_check INTEGER;
  v_result JSON;
  v_age_note TEXT := '';
  v_convenio_normalizado TEXT;
BEGIN
  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'cliente_id é obrigatório';
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

  -- Normalizar convênio para comparação (remove espaços e pontuação, mantém apenas A-Z0-9%)
  v_convenio_normalizado := regexp_replace(upper(trim(p_convenio)), '[^A-Z0-9%]+', '', 'g');

  -- Buscar médico
  SELECT m.*, m.ativo, m.idade_minima, m.idade_maxima, m.convenios_aceitos
  INTO v_doctor_record
  FROM public.medicos m
  WHERE m.id = p_medico_id
    AND m.cliente_id = p_cliente_id;

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
    AND cliente_id = p_cliente_id
    AND status = 'ativo'
    AND p_data_agendamento BETWEEN data_inicio AND data_fim;

  IF v_blocked_check > 0 THEN
    RAISE EXCEPTION 'A agenda está bloqueada nesta data';
  END IF;

  -- Validar data/hora não seja no passado
  IF (p_data_agendamento::timestamp + p_hora_agendamento) < (now() - interval '1 hour') THEN
    RAISE EXCEPTION 'Não é possível agendar para uma data/hora que já passou';
  END IF;

  -- Verificar conflitos
  IF NOT p_force_conflict THEN
    SELECT COUNT(*)
    INTO v_conflict_check
    FROM public.agendamentos
    WHERE medico_id = p_medico_id
      AND cliente_id = p_cliente_id
      AND data_agendamento = p_data_agendamento
      AND hora_agendamento = p_hora_agendamento
      AND status IN ('agendado', 'confirmado');

    IF v_conflict_check > 0 THEN
      RETURN json_build_object(
        'success', false,
        'error', 'CONFLICT',
        'message', 'Este horário já está agendado para este médico',
        'data_agendamento', p_data_agendamento,
        'hora_agendamento', p_hora_agendamento
      );
    END IF;
  END IF;

  -- Calcular idade
  SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_data_nascimento))::INTEGER
  INTO v_patient_age;

  -- Validar idade mínima
  IF v_doctor_record.idade_minima IS NOT NULL AND v_patient_age < v_doctor_record.idade_minima THEN
    v_age_note := v_age_note || format(' [Idade %s anos - abaixo do padrão %s anos]', v_patient_age, v_doctor_record.idade_minima);
  END IF;

  -- Validar idade máxima
  IF v_doctor_record.idade_maxima IS NOT NULL AND v_patient_age > v_doctor_record.idade_maxima THEN
    v_age_note := v_age_note || format(' [Idade %s anos - acima do padrão %s anos]', v_patient_age, v_doctor_record.idade_maxima);
  END IF;

  -- Validar convênio - normaliza cada elemento do array antes de comparar
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

  -- Buscar ou criar paciente
  SELECT id INTO v_paciente_id
  FROM public.pacientes
  WHERE LOWER(TRIM(nome_completo)) = LOWER(TRIM(p_nome_completo))
    AND data_nascimento = p_data_nascimento
    AND upper(trim(convenio)) = upper(trim(p_convenio))
    AND cliente_id = p_cliente_id
  LIMIT 1;

  IF v_paciente_id IS NULL THEN
    INSERT INTO public.pacientes (
      nome_completo, data_nascimento, convenio, telefone, celular, cliente_id
    ) VALUES (
      UPPER(TRIM(p_nome_completo)), p_data_nascimento, upper(trim(p_convenio)), 
      p_telefone, COALESCE(p_celular, ''), p_cliente_id
    ) RETURNING id INTO v_paciente_id;
  END IF;

  -- Criar agendamento
  INSERT INTO public.agendamentos (
    paciente_id, medico_id, atendimento_id, data_agendamento, hora_agendamento,
    convenio, observacoes, criado_por, status, cliente_id
  ) VALUES (
    v_paciente_id, p_medico_id, p_atendimento_id, p_data_agendamento, p_hora_agendamento,
    upper(trim(p_convenio)), COALESCE(p_observacoes, '') || COALESCE(v_age_note, ''), 
    p_criado_por, 'agendado', p_cliente_id
  ) RETURNING id INTO v_agendamento_id;

  -- Retornar sucesso
  RETURN json_build_object(
    'success', true,
    'agendamento_id', v_agendamento_id,
    'paciente_id', v_paciente_id,
    'message', CASE WHEN v_age_note != '' THEN 
      'Agendamento criado com observações de idade' 
    ELSE 
      'Agendamento criado com sucesso' 
    END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Erro ao criar agendamento: ' || SQLERRM
    );
END;
$$;