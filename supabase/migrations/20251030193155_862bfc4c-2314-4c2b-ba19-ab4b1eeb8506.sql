-- Melhorar mensagens de erro de conflito para incluir nome do paciente

CREATE OR REPLACE FUNCTION public.criar_agendamento_atomico_externo(
  p_cliente_id uuid, 
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
  p_criado_por text DEFAULT 'LLM Agent'::text, 
  p_force_conflict boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_paciente_id uuid;
  v_agendamento_id uuid;
  v_conflito_existe boolean;
  v_doctor_record RECORD;
  v_patient_age integer;
  v_blocked_check integer;
  v_age_note text := '';
  v_convenio_aceito boolean := false;
  v_paciente_conflito text;
BEGIN
  -- Validar cliente_id obrigatório
  IF p_cliente_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'cliente_id é obrigatório'
    );
  END IF;

  -- Validar campos obrigatórios
  IF p_medico_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Médico é obrigatório');
  END IF;

  IF p_atendimento_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Atendimento é obrigatório');
  END IF;

  IF p_data_agendamento IS NULL OR p_hora_agendamento IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Data e hora são obrigatórias');
  END IF;

  -- Buscar dados do médico
  SELECT m.*, m.ativo, m.idade_minima, m.idade_maxima, m.convenios_aceitos
  INTO v_doctor_record
  FROM public.medicos m
  WHERE m.id = p_medico_id AND m.cliente_id = p_cliente_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Médico não encontrado');
  END IF;

  IF NOT v_doctor_record.ativo THEN
    RETURN jsonb_build_object('success', false, 'error', 'Médico não está ativo');
  END IF;

  -- Verificar bloqueios de agenda
  SELECT COUNT(*)
  INTO v_blocked_check
  FROM public.bloqueios_agenda
  WHERE medico_id = p_medico_id
    AND status = 'ativo'
    AND p_data_agendamento BETWEEN data_inicio AND data_fim
    AND cliente_id = p_cliente_id;

  IF v_blocked_check > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A agenda está bloqueada nesta data');
  END IF;

  -- Validar idade do paciente
  IF p_data_nascimento IS NOT NULL THEN
    SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_data_nascimento))::integer
    INTO v_patient_age;

    IF v_doctor_record.idade_minima IS NOT NULL AND v_patient_age < v_doctor_record.idade_minima THEN
      v_age_note := v_age_note || format(' [Idade %s anos - abaixo do padrão %s anos]', v_patient_age, v_doctor_record.idade_minima);
    END IF;

    IF v_doctor_record.idade_maxima IS NOT NULL AND v_patient_age > v_doctor_record.idade_maxima THEN
      v_age_note := v_age_note || format(' [Idade %s anos - acima do padrão %s anos]', v_patient_age, v_doctor_record.idade_maxima);
    END IF;
  END IF;

  -- Validar convênio com comparação CASE-INSENSITIVE
  IF v_doctor_record.convenios_aceitos IS NOT NULL AND array_length(v_doctor_record.convenios_aceitos, 1) > 0 THEN
    -- Verificar se o convênio existe no array (case-insensitive)
    SELECT EXISTS (
      SELECT 1 FROM unnest(v_doctor_record.convenios_aceitos) AS convenio
      WHERE LOWER(convenio) = LOWER(p_convenio)
    ) INTO v_convenio_aceito;
    
    IF NOT v_convenio_aceito THEN
      RETURN jsonb_build_object('success', false, 'error', format('Convênio "%s" não é aceito por este médico', p_convenio));
    END IF;
  END IF;

  -- Buscar paciente existente
  SELECT id INTO v_paciente_id
  FROM public.pacientes
  WHERE LOWER(TRIM(nome_completo)) = LOWER(TRIM(p_nome_completo))
    AND data_nascimento = p_data_nascimento
    AND LOWER(convenio) = LOWER(p_convenio)
    AND cliente_id = p_cliente_id
  LIMIT 1;

  -- Criar paciente se não existir
  IF v_paciente_id IS NULL THEN
    INSERT INTO public.pacientes (
      cliente_id, nome_completo, data_nascimento, 
      convenio, telefone, celular
    ) VALUES (
      p_cliente_id, 
      UPPER(TRIM(p_nome_completo)), 
      p_data_nascimento,
      p_convenio, 
      p_telefone, 
      COALESCE(p_celular, '')
    )
    RETURNING id INTO v_paciente_id;
  END IF;

  -- Verificar conflitos de horário COM BUSCA DO NOME DO PACIENTE
  IF NOT p_force_conflict THEN
    -- Buscar nome do paciente conflitante
    SELECT p.nome_completo INTO v_paciente_conflito
    FROM public.agendamentos a
    JOIN public.pacientes p ON a.paciente_id = p.id
    WHERE a.medico_id = p_medico_id
      AND a.data_agendamento = p_data_agendamento
      AND a.hora_agendamento = p_hora_agendamento
      AND a.cliente_id = p_cliente_id
      AND a.status IN ('agendado', 'confirmado')
    LIMIT 1;
    
    IF v_paciente_conflito IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'CONFLICT',
        'message', format('Este horário já está agendado para %s. Por favor, escolha outro horário.', v_paciente_conflito),
        'paciente_existente', v_paciente_conflito,
        'data_agendamento', p_data_agendamento,
        'hora_agendamento', p_hora_agendamento::text
      );
    END IF;
  END IF;

  -- Criar agendamento
  INSERT INTO public.agendamentos (
    cliente_id, paciente_id, medico_id, atendimento_id,
    data_agendamento, hora_agendamento, convenio,
    status, observacoes, criado_por
  ) VALUES (
    p_cliente_id, 
    v_paciente_id, 
    p_medico_id, 
    p_atendimento_id,
    p_data_agendamento, 
    p_hora_agendamento, 
    p_convenio,
    'agendado', 
    COALESCE(p_observacoes, '') || COALESCE(v_age_note, ''), 
    p_criado_por
  )
  RETURNING id INTO v_agendamento_id;

  RETURN jsonb_build_object(
    'success', true,
    'agendamento_id', v_agendamento_id,
    'paciente_id', v_paciente_id,
    'message', CASE 
      WHEN v_age_note != '' THEN 'Agendamento criado com observações de idade' 
      ELSE 'Agendamento criado com sucesso' 
    END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Erro ao criar agendamento: ' || SQLERRM
    );
END;
$function$;

-- Comentário explicativo
COMMENT ON FUNCTION public.criar_agendamento_atomico_externo IS 
'Atualizado para retornar mensagem de conflito com nome do paciente existente quando há sobreposição de horários';