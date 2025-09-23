-- Criar função RPC para buscar agendamentos otimizado para IPADO
CREATE OR REPLACE FUNCTION public.buscar_agendamentos_otimizado_ipado()
RETURNS TABLE (
  id uuid,
  paciente_id uuid,
  medico_id uuid,
  atendimento_id uuid,
  data_agendamento date,
  hora_agendamento time,
  status text,
  observacoes text,
  created_at timestamptz,
  updated_at timestamptz,
  criado_por text,
  criado_por_user_id uuid,
  paciente_nome text,
  paciente_convenio text,
  paciente_celular text,
  paciente_telefone text,
  paciente_data_nascimento date,
  medico_nome text,
  medico_especialidade text,
  atendimento_nome text,
  atendimento_tipo text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.paciente_id,
    a.medico_id,
    a.atendimento_id,
    a.data_agendamento,
    a.hora_agendamento,
    a.status::text,
    a.observacoes,
    a.created_at,
    a.updated_at,
    a.criado_por,
    a.criado_por_user_id,
    p.nome_completo as paciente_nome,
    p.convenio as paciente_convenio,
    p.celular as paciente_celular,
    p.telefone as paciente_telefone,
    p.data_nascimento as paciente_data_nascimento,
    m.nome as medico_nome,
    m.especialidade as medico_especialidade,
    at.nome as atendimento_nome,
    at.tipo as atendimento_tipo
  FROM public.ipado_agendamentos a
  JOIN public.ipado_pacientes p ON a.paciente_id = p.id
  JOIN public.ipado_medicos m ON a.medico_id = m.id
  JOIN public.ipado_atendimentos at ON a.atendimento_id = at.id
  WHERE a.status != 'cancelado'
  ORDER BY a.data_agendamento DESC, a.hora_agendamento DESC;
END;
$$;

-- Criar função RPC para criar agendamento atômico para IPADO
CREATE OR REPLACE FUNCTION public.criar_agendamento_atomico_ipado(
  p_nome_completo text,
  p_data_nascimento date,
  p_convenio text,
  p_telefone text,
  p_celular text,
  p_medico_id uuid,
  p_atendimento_id uuid,
  p_data_agendamento date,
  p_hora_agendamento time,
  p_observacoes text DEFAULT NULL,
  p_criado_por text DEFAULT 'recepcionista',
  p_criado_por_user_id uuid DEFAULT NULL,
  p_force_conflict boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id UUID;
  v_agendamento_id UUID;
  v_doctor_record RECORD;
  v_patient_age INTEGER;
  v_blocked_check INTEGER;
  v_conflict_check INTEGER;
  v_result JSON;
  v_age_note TEXT := '';
BEGIN
  -- Verificar se médico está ativo e buscar restrições
  SELECT m.*, m.ativo, m.idade_minima, m.idade_maxima, m.convenios_aceitos
  INTO v_doctor_record
  FROM public.ipado_medicos m
  WHERE m.id = p_medico_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Médico não encontrado'
    );
  END IF;
  
  IF NOT v_doctor_record.ativo THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Médico não está ativo'
    );
  END IF;
  
  -- Verificar bloqueios de agenda
  SELECT COUNT(*)
  INTO v_blocked_check
  FROM public.ipado_bloqueios_agenda
  WHERE medico_id = p_medico_id
    AND status = 'ativo'
    AND p_data_agendamento BETWEEN data_inicio AND data_fim;
  
  IF v_blocked_check > 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'A agenda está bloqueada nesta data'
    );
  END IF;
  
  -- Validar data/hora não é no passado
  IF (p_data_agendamento::timestamp + p_hora_agendamento) < (now() - interval '1 hour') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Não é possível agendar para uma data/hora que já passou'
    );
  END IF;
  
  -- Verificar conflitos de horário se não forçar
  IF NOT p_force_conflict THEN
    SELECT COUNT(*)
    INTO v_conflict_check
    FROM public.ipado_agendamentos
    WHERE medico_id = p_medico_id
      AND data_agendamento = p_data_agendamento
      AND hora_agendamento = p_hora_agendamento
      AND status IN ('agendado', 'confirmado');
    
    IF v_conflict_check > 0 THEN
      RETURN json_build_object(
        'success', false,
        'conflict_detected', true,
        'message', 'Conflito de horário detectado'
      );
    END IF;
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
    RETURN json_build_object(
      'success', false,
      'error', format('Convênio "%s" não é aceito por este médico', p_convenio)
    );
  END IF;
  
  -- Criar ou buscar paciente existente
  SELECT id INTO v_paciente_id
  FROM public.ipado_pacientes
  WHERE LOWER(nome_completo) = LOWER(p_nome_completo)
    AND data_nascimento = p_data_nascimento
    AND convenio = p_convenio
  LIMIT 1;
  
  IF v_paciente_id IS NULL THEN
    INSERT INTO public.ipado_pacientes (
      nome_completo, data_nascimento, convenio, telefone, celular
    ) VALUES (
      p_nome_completo, p_data_nascimento, p_convenio, p_telefone, COALESCE(p_celular, '')
    ) RETURNING id INTO v_paciente_id;
  END IF;
  
  -- Criar agendamento
  INSERT INTO public.ipado_agendamentos (
    paciente_id, medico_id, atendimento_id, data_agendamento, hora_agendamento,
    convenio, observacoes, criado_por, criado_por_user_id, status
  ) VALUES (
    v_paciente_id, p_medico_id, p_atendimento_id, p_data_agendamento, p_hora_agendamento,
    p_convenio, coalesce(p_observacoes, '') || coalesce(v_age_note, ''), p_criado_por, p_criado_por_user_id, 'agendado'
  ) RETURNING id INTO v_agendamento_id;
  
  -- Retorno
  SELECT json_build_object(
    'success', true,
    'agendamento_id', v_agendamento_id,
    'paciente_id', v_paciente_id,
    'message', CASE WHEN v_age_note <> '' THEN 
      'Agendamento criado com observações de idade' 
    ELSE 'Agendamento criado com sucesso' END,
    'forced_conflict', p_force_conflict
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
$$;