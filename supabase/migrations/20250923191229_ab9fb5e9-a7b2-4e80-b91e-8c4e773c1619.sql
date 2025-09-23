-- Corrigir as funções restantes que ainda podem estar sem search_path
CREATE OR REPLACE FUNCTION public.criar_cliente_ipado()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.clientes WHERE nome = 'IPADO') THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Cliente IPADO já existe'
    );
  END IF;

  INSERT INTO public.clientes (
    nome,
    ativo,
    configuracoes
  ) VALUES (
    'IPADO',
    true,
    '{"tipo": "clinica", "sistema_origem": "manual"}'::jsonb
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Cliente IPADO criado com sucesso'
  );
END;
$$;

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
SET search_path = public
AS $$
DECLARE
  v_paciente_id UUID;
  v_agendamento_ids UUID[] := '{}';
  v_doctor_record RECORD;
  v_patient_age INTEGER;
  v_blocked_check INTEGER;
  v_result JSON;
  v_atendimento_id UUID;
  v_current_agendamento_id UUID;
  v_combined_observations TEXT := '';
  v_atendimento_name TEXT;
  v_atendimento_names TEXT[] := '{}';
  v_age_note TEXT := '';
BEGIN
  IF array_length(p_atendimento_ids, 1) IS NULL OR array_length(p_atendimento_ids, 1) = 0 THEN
    RAISE EXCEPTION 'É necessário selecionar pelo menos um atendimento';
  END IF;

  FOR v_atendimento_id IN SELECT unnest(p_atendimento_ids)
  LOOP
    SELECT nome INTO v_atendimento_name FROM public.atendimentos WHERE id = v_atendimento_id;
    IF v_atendimento_name IS NOT NULL THEN
      v_atendimento_names := array_append(v_atendimento_names, v_atendimento_name);
    END IF;
  END LOOP;

  IF array_length(v_atendimento_names, 1) > 1 THEN
    v_combined_observations := 'Agendamento múltiplo: ' || array_to_string(v_atendimento_names, ' + ');
    IF p_observacoes IS NOT NULL AND trim(p_observacoes) <> '' THEN
      v_combined_observations := v_combined_observations || '. ' || p_observacoes;
    END IF;
  ELSE
    v_combined_observations := p_observacoes;
  END IF;
  
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
  
  SELECT COUNT(*)
  INTO v_blocked_check
  FROM public.bloqueios_agenda
  WHERE medico_id = p_medico_id
    AND status = 'ativo'
    AND p_data_agendamento BETWEEN data_inicio AND data_fim;
  
  IF v_blocked_check > 0 THEN
    RAISE EXCEPTION 'A agenda está bloqueada nesta data';
  END IF;
  
  IF (p_data_agendamento::timestamp + p_hora_agendamento) < (now() - interval '1 hour') THEN
    RAISE EXCEPTION 'Não é possível agendar para uma data/hora que já passou';
  END IF;
  
  SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_data_nascimento))::INTEGER
  INTO v_patient_age;
  
  IF v_doctor_record.idade_minima IS NOT NULL AND v_patient_age < v_doctor_record.idade_minima THEN
    v_age_note := v_age_note || format(' [Idade %s anos - abaixo do padrão %s anos]', v_patient_age, v_doctor_record.idade_minima);
  END IF;
  
  IF v_doctor_record.idade_maxima IS NOT NULL AND v_patient_age > v_doctor_record.idade_maxima THEN
    v_age_note := v_age_note || format(' [Idade %s anos - acima do padrão %s anos]', v_patient_age, v_doctor_record.idade_maxima);
  END IF;

  IF v_doctor_record.convenios_aceitos IS NOT NULL AND 
     array_length(v_doctor_record.convenios_aceitos, 1) > 0 AND
     NOT (p_convenio = ANY(v_doctor_record.convenios_aceitos)) THEN
    RAISE EXCEPTION 'Convênio "%" não é aceito por este médico', p_convenio;
  END IF;
  
  SELECT id INTO v_paciente_id
  FROM public.pacientes
  WHERE LOWER(nome_completo) = LOWER(p_nome_completo)
    AND data_nascimento = p_data_nascimento
    AND convenio = p_convenio
  LIMIT 1;
  
  IF v_paciente_id IS NULL THEN
    INSERT INTO public.pacientes (
      nome_completo, data_nascimento, convenio, telefone, celular
    ) VALUES (
      p_nome_completo, p_data_nascimento, p_convenio, p_telefone, COALESCE(p_celular, '')
    ) RETURNING id INTO v_paciente_id;
  END IF;
  
  FOR v_atendimento_id IN SELECT unnest(p_atendimento_ids)
  LOOP
    INSERT INTO public.agendamentos (
      paciente_id, medico_id, atendimento_id, data_agendamento, hora_agendamento,
      convenio, observacoes, criado_por, criado_por_user_id, status
    ) VALUES (
      v_paciente_id, p_medico_id, v_atendimento_id, p_data_agendamento, p_hora_agendamento,
      p_convenio, coalesce(v_combined_observations, '') || coalesce(v_age_note, ''), p_criado_por, p_criado_por_user_id, 'agendado'
    ) RETURNING id INTO v_current_agendamento_id;
    
    v_agendamento_ids := array_append(v_agendamento_ids, v_current_agendamento_id);
  END LOOP;
  
  SELECT json_build_object(
    'success', true,
    'agendamento_ids', v_agendamento_ids,
    'paciente_id', v_paciente_id,
    'total_agendamentos', array_length(v_agendamento_ids, 1),
    'atendimentos', v_atendimento_names,
    'message', CASE WHEN v_age_note <> '' THEN 
      'Agendamento múltiplo criado com observações de idade' 
    ELSE 'Agendamento múltiplo criado com sucesso' END
  ) INTO v_result;
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Erro ao criar agendamento múltiplo: ' || SQLERRM
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.rejeitar_usuario(p_user_id uuid, p_aprovador_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_aprovador_id 
    AND role = 'admin' 
    AND status = 'aprovado'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem rejeitar usuários'
    );
  END IF;

  UPDATE public.profiles 
  SET 
    status = 'rejeitado',
    aprovado_por = p_aprovador_id,
    data_aprovacao = now()
  WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário rejeitado'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.recuperar_usuario_orfao(
  p_email text, 
  p_nome text, 
  p_role text DEFAULT 'recepcionista'::text, 
  p_cliente_id uuid DEFAULT NULL::uuid, 
  p_admin_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile_exists boolean := false;
  v_cliente_ipado_id uuid;
BEGIN
  SELECT au.id INTO v_user_id
  FROM auth.users au
  WHERE au.email = p_email;
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado no sistema de autenticação'
    );
  END IF;
  
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = v_user_id) INTO v_profile_exists;
  
  IF v_profile_exists THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário já possui perfil criado'
    );
  END IF;
  
  IF p_cliente_id IS NULL THEN
    SELECT id INTO v_cliente_ipado_id 
    FROM public.clientes 
    WHERE nome = 'IPADO' 
    LIMIT 1;
    
    IF v_cliente_ipado_id IS NULL THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Cliente IPADO não encontrado'
      );
    END IF;
  ELSE
    v_cliente_ipado_id := p_cliente_id;
  END IF;
  
  UPDATE auth.users 
  SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE id = v_user_id;
  
  INSERT INTO public.profiles (
    user_id,
    nome,
    email,
    role,
    status,
    ativo,
    cliente_id,
    aprovado_por,
    data_aprovacao,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_nome,
    p_email,
    p_role,
    'aprovado',
    true,
    v_cliente_ipado_id,
    p_admin_id,
    now(),
    now(),
    now()
  );
  
  INSERT INTO public.system_logs (
    timestamp, level, message, context, user_id
  ) VALUES (
    now(), 'info', 
    FORMAT('Usuário órfão recuperado: %s (%s)', p_email, p_nome),
    'USER_RECOVERY',
    p_admin_id
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Usuário órfão recuperado com sucesso',
    'user_id', v_user_id,
    'profile_created', true
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Erro interno: ' || SQLERRM
    );
END;
$$;