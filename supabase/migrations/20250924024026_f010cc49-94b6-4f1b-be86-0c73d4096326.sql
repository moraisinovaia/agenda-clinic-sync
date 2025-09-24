-- Correção definitiva da função duplicada criar_agendamento_atomico

-- 1. Listar e remover especificamente as funções duplicadas
DO $$
DECLARE
  func_record RECORD;
BEGIN
  -- Primeiro, dropar todas as versões da função específicamente
  FOR func_record IN 
    SELECT specific_name, routine_name
    FROM information_schema.routines 
    WHERE routine_name = 'criar_agendamento_atomico'
    AND routine_schema = 'public'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I CASCADE', func_record.specific_name);
  END LOOP;
  
  -- Log da limpeza
  INSERT INTO public.system_logs (
    timestamp, level, message, context, data
  ) VALUES (
    now(), 'info', 
    'Limpeza de funções duplicadas executada',
    'FUNCTION_CLEANUP',
    jsonb_build_object('function_name', 'criar_agendamento_atomico')
  );
END $$;

-- 2. Recriar a função correta
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
  p_criado_por_user_id UUID DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id UUID;
  v_agendamento_id UUID;
  v_doctor_record RECORD;
  v_patient_age INTEGER;
  v_conflict_check INTEGER;
  v_result JSON;
  v_age_note TEXT := '';
  v_cliente_id UUID;
BEGIN
  -- Obter cliente_id (assumindo IPADO por padrão)
  SELECT id INTO v_cliente_id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1;

  -- Validações básicas
  IF p_nome_completo IS NULL OR trim(p_nome_completo) = '' THEN
    RAISE EXCEPTION 'Nome completo é obrigatório';
  END IF;

  IF p_data_nascimento IS NULL THEN
    RAISE EXCEPTION 'Data de nascimento é obrigatória';
  END IF;

  -- Verificar se médico existe e está ativo
  SELECT * INTO v_doctor_record
  FROM public.medicos
  WHERE id = p_medico_id AND ativo = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Médico não encontrado ou não está ativo';
  END IF;

  -- Verificar conflitos de horário
  SELECT COUNT(*) INTO v_conflict_check
  FROM public.agendamentos
  WHERE medico_id = p_medico_id
    AND data_agendamento = p_data_agendamento
    AND hora_agendamento = p_hora_agendamento
    AND status IN ('agendado', 'confirmado');

  IF v_conflict_check > 0 THEN
    RAISE EXCEPTION 'Horário já ocupado para este médico';
  END IF;

  -- Verificar idade do paciente
  SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_data_nascimento))::INTEGER
  INTO v_patient_age;
  
  IF v_doctor_record.idade_minima IS NOT NULL AND v_patient_age < v_doctor_record.idade_minima THEN
    v_age_note := format(' [Idade %s anos - abaixo do padrão %s anos]', v_patient_age, v_doctor_record.idade_minima);
  END IF;
  
  IF v_doctor_record.idade_maxima IS NOT NULL AND v_patient_age > v_doctor_record.idade_maxima THEN
    v_age_note := format(' [Idade %s anos - acima do padrão %s anos]', v_patient_age, v_doctor_record.idade_maxima);
  END IF;

  -- Buscar ou criar paciente
  SELECT id INTO v_paciente_id
  FROM public.pacientes
  WHERE LOWER(nome_completo) = LOWER(p_nome_completo)
    AND data_nascimento = p_data_nascimento
    AND convenio = p_convenio
    AND cliente_id = v_cliente_id
  LIMIT 1;
  
  IF v_paciente_id IS NULL THEN
    INSERT INTO public.pacientes (
      nome_completo, data_nascimento, convenio, telefone, celular, cliente_id
    ) VALUES (
      p_nome_completo, p_data_nascimento, p_convenio, p_telefone, COALESCE(p_celular, ''), v_cliente_id
    ) RETURNING id INTO v_paciente_id;
  END IF;

  -- Criar agendamento
  INSERT INTO public.agendamentos (
    paciente_id, medico_id, atendimento_id, data_agendamento, hora_agendamento,
    convenio, observacoes, criado_por, criado_por_user_id, status, cliente_id
  ) VALUES (
    v_paciente_id, p_medico_id, p_atendimento_id, p_data_agendamento, p_hora_agendamento,
    p_convenio, COALESCE(p_observacoes, '') || v_age_note, p_criado_por, p_criado_por_user_id, 'agendado', v_cliente_id
  ) RETURNING id INTO v_agendamento_id;

  -- Retornar resultado
  RETURN json_build_object(
    'success', true,
    'agendamento_id', v_agendamento_id,
    'paciente_id', v_paciente_id,
    'message', CASE WHEN v_age_note <> '' THEN 
      'Agendamento criado com observações de idade' 
    ELSE 'Agendamento criado com sucesso' END
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

-- 3. Executar alguns testes rápidos
DO $$
DECLARE
  v_cliente_id UUID;
  v_medico_id UUID;
  v_atendimento_id UUID;
  v_result JSON;
  v_sucessos INTEGER := 0;
  v_total INTEGER := 0;
BEGIN
  -- Obter IDs necessários
  SELECT id INTO v_cliente_id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1;
  SELECT id INTO v_medico_id FROM public.medicos WHERE ativo = true AND cliente_id = v_cliente_id LIMIT 1;
  SELECT id INTO v_atendimento_id FROM public.atendimentos WHERE ativo = true AND cliente_id = v_cliente_id LIMIT 1;

  -- Teste 1: Agendamento básico
  v_total := v_total + 1;
  BEGIN
    SELECT public.criar_agendamento_atomico(
      'Maria Silva (TESTE)',
      '1979-01-15'::DATE,
      'Unimed',
      '11999111111',
      '11999111111',
      v_medico_id,
      v_atendimento_id,
      '2024-09-25'::DATE,
      '08:00'::TIME,
      'TESTE AUTOMATIZADO - Função corrigida',
      'sistema_teste',
      NULL
    ) INTO v_result;
    
    IF (v_result->>'success')::boolean THEN
      v_sucessos := v_sucessos + 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Continuar
  END;

  -- Teste 2: Segundo agendamento
  v_total := v_total + 1;
  BEGIN
    SELECT public.criar_agendamento_atomico(
      'João Santos (TESTE)',
      '1999-03-20'::DATE,
      'SUS',
      '11999222222',
      '11999222222',
      v_medico_id,
      v_atendimento_id,
      '2024-09-25'::DATE,
      '09:00'::TIME,
      'TESTE AUTOMATIZADO - Segundo agendamento',
      'sistema_teste',
      NULL
    ) INTO v_result;
    
    IF (v_result->>'success')::boolean THEN
      v_sucessos := v_sucessos + 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Continuar
  END;

  -- Log final
  INSERT INTO public.system_logs (
    timestamp, level, message, context, data
  ) VALUES (
    now(), 'info', 
    'Testes rápidos da função corrigida finalizados',
    'FUNCTION_TEST_FINAL',
    jsonb_build_object(
      'total_testes', v_total,
      'sucessos', v_sucessos,
      'taxa_sucesso', CASE WHEN v_total > 0 THEN ROUND((v_sucessos::DECIMAL / v_total::DECIMAL) * 100, 2) ELSE 0 END
    )
  );

  RAISE NOTICE 'FUNÇÃO CORRIGIDA - Testes: % | Sucessos: %', v_total, v_sucessos;
END $$;