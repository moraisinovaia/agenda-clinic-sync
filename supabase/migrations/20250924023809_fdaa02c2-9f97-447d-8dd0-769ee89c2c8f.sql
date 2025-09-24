-- Plano de Testes Completos do Sistema de Agendamentos
-- Criando pacientes de teste e agendamentos para validar todo o sistema

-- 1. Primeiro, obter o cliente_id da IPADO
DO $$
DECLARE
  v_cliente_id UUID;
  v_medico_id UUID;
  v_atendimento_id UUID;
  v_paciente_id UUID;
  v_result JSON;
  v_test_date DATE := '2024-09-25';
  v_test_times TIME[] := ARRAY['08:00', '09:00', '10:00', '14:00', '15:00', '16:00'];
  v_time TIME;
  v_medico_record RECORD;
  v_atendimento_record RECORD;
  v_total_agendamentos INTEGER := 0;
  v_total_testes INTEGER := 0;
  v_sucessos INTEGER := 0;
  v_erros INTEGER := 0;
  v_log_data JSONB := '{}';
BEGIN
  -- Obter cliente_id
  SELECT id INTO v_cliente_id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1;
  
  -- Log início dos testes
  INSERT INTO public.system_logs (
    timestamp, level, message, context, data
  ) VALUES (
    now(), 'info', 
    'Iniciando testes completos do sistema de agendamentos',
    'AGENDAMENTOS_TEST_START',
    jsonb_build_object('cliente_id', v_cliente_id, 'data_teste', v_test_date)
  );

  -- 2. CRIAR PACIENTES DE TESTE
  -- Paciente 1: Maria Silva, 45 anos, Unimed
  INSERT INTO public.pacientes (
    nome_completo, data_nascimento, convenio, telefone, celular, cliente_id
  ) VALUES (
    'Maria Silva (TESTE)', '1979-01-15', 'Unimed', '11999111111', '11999111111', v_cliente_id
  ) RETURNING id INTO v_paciente_id;
  
  -- Paciente 2: João Santos, 25 anos, SUS
  INSERT INTO public.pacientes (
    nome_completo, data_nascimento, convenio, telefone, celular, cliente_id
  ) VALUES (
    'João Santos (TESTE)', '1999-03-20', 'SUS', '11999222222', '11999222222', v_cliente_id
  );
  
  -- Paciente 3: Ana Costa, 70 anos, Particular
  INSERT INTO public.pacientes (
    nome_completo, data_nascimento, convenio, telefone, celular, cliente_id
  ) VALUES (
    'Ana Costa (TESTE)', '1954-07-10', 'Particular', '11999333333', '11999333333', v_cliente_id
  );
  
  -- Paciente 4: Pedro Lima, 35 anos, Bradesco Saúde
  INSERT INTO public.pacientes (
    nome_completo, data_nascimento, convenio, telefone, celular, cliente_id
  ) VALUES (
    'Pedro Lima (TESTE)', '1989-12-05', 'Bradesco Saúde', '11999444444', '11999444444', v_cliente_id
  );
  
  -- Paciente 5: Carla Oliveira, 50 anos, Amil
  INSERT INTO public.pacientes (
    nome_completo, data_nascimento, convenio, telefone, celular, cliente_id
  ) VALUES (
    'Carla Oliveira (TESTE)', '1974-09-25', 'Amil', '11999555555', '11999555555', v_cliente_id
  );

  -- 3. TESTES DE AGENDAMENTOS SIMPLES
  -- Para cada médico ativo, testar agendamentos simples
  FOR v_medico_record IN 
    SELECT id, nome FROM public.medicos 
    WHERE ativo = true AND cliente_id = v_cliente_id
    ORDER BY nome
  LOOP
    -- Para cada tipo de atendimento
    FOR v_atendimento_record IN 
      SELECT id, nome, tipo FROM public.atendimentos 
      WHERE ativo = true AND cliente_id = v_cliente_id
      ORDER BY tipo, nome
      LIMIT 3 -- Limitar para não sobrecarregar
    LOOP
      -- Testar em horário da manhã
      BEGIN
        v_total_testes := v_total_testes + 1;
        
        -- Usar função atomica para criar agendamento
        SELECT public.criar_agendamento_atomico(
          'Maria Silva (TESTE)',
          '1979-01-15'::DATE,
          'Unimed',
          '11999111111',
          '11999111111',
          v_medico_record.id,
          v_atendimento_record.id,
          v_test_date,
          '08:00'::TIME,
          'TESTE AUTOMATIZADO - ' || v_atendimento_record.nome || ' com ' || v_medico_record.nome,
          'sistema_teste',
          NULL
        ) INTO v_result;
        
        IF (v_result->>'success')::boolean THEN
          v_sucessos := v_sucessos + 1;
          v_total_agendamentos := v_total_agendamentos + 1;
        ELSE
          v_erros := v_erros + 1;
        END IF;
        
        -- Próxima data para não conflitar
        v_test_date := v_test_date + INTERVAL '1 day';
        
      EXCEPTION WHEN OTHERS THEN
        v_erros := v_erros + 1;
        -- Log do erro
        INSERT INTO public.system_logs (
          timestamp, level, message, context, data
        ) VALUES (
          now(), 'error', 
          'Erro no teste de agendamento simples: ' || SQLERRM,
          'AGENDAMENTOS_TEST_ERROR',
          jsonb_build_object(
            'medico', v_medico_record.nome,
            'atendimento', v_atendimento_record.nome,
            'error', SQLERRM
          )
        );
      END;
    END LOOP;
  END LOOP;

  -- 4. TESTES DE AGENDAMENTOS MÚLTIPLOS
  -- Testar agendamento múltiplo com Pedro Lima
  BEGIN
    v_total_testes := v_total_testes + 1;
    
    SELECT public.criar_agendamento_multiplo(
      'Pedro Lima (TESTE)',
      '1989-12-05'::DATE,
      'Bradesco Saúde',
      '11999444444',
      '11999444444',
      (SELECT id FROM public.medicos WHERE nome LIKE '%Dr%' AND ativo = true AND cliente_id = v_cliente_id LIMIT 1),
      ARRAY(SELECT id FROM public.atendimentos WHERE ativo = true AND cliente_id = v_cliente_id LIMIT 2),
      '2024-09-30'::DATE,
      '14:00'::TIME,
      'TESTE AGENDAMENTO MÚLTIPLO',
      'sistema_teste',
      NULL
    ) INTO v_result;
    
    IF (v_result->>'success')::boolean THEN
      v_sucessos := v_sucessos + 1;
      v_total_agendamentos := v_total_agendamentos + (v_result->>'total_agendamentos')::integer;
    ELSE
      v_erros := v_erros + 1;
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    v_erros := v_erros + 1;
  END;

  -- 5. TESTES DE VALIDAÇÃO DE CONFLITOS
  -- Tentar criar agendamento no mesmo horário (deve dar conflito)
  BEGIN
    v_total_testes := v_total_testes + 1;
    
    SELECT public.validar_conflito_agendamento(
      (SELECT id FROM public.medicos WHERE ativo = true AND cliente_id = v_cliente_id LIMIT 1),
      '2024-09-25'::DATE,
      '08:00'::TIME
    ) INTO v_result;
    
    -- Se detectou conflito corretamente, é um sucesso
    IF (v_result->>'has_conflict')::boolean THEN
      v_sucessos := v_sucessos + 1;
    ELSE
      v_erros := v_erros + 1;
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    v_erros := v_erros + 1;
  END;

  -- 6. RELATÓRIO FINAL DOS TESTES
  v_log_data := jsonb_build_object(
    'total_testes', v_total_testes,
    'sucessos', v_sucessos,
    'erros', v_erros,
    'taxa_sucesso', ROUND((v_sucessos::DECIMAL / v_total_testes::DECIMAL) * 100, 2),
    'total_agendamentos_criados', v_total_agendamentos,
    'pacientes_teste_criados', 5,
    'data_inicio_testes', '2024-09-25',
    'data_fim_testes', v_test_date
  );

  INSERT INTO public.system_logs (
    timestamp, level, message, context, data
  ) VALUES (
    now(), 'info', 
    'Testes completos do sistema de agendamentos finalizados',
    'AGENDAMENTOS_TEST_COMPLETE',
    v_log_data
  );

  -- Exibir resultado final
  RAISE NOTICE 'RELATÓRIO DE TESTES COMPLETO:';
  RAISE NOTICE '================================';
  RAISE NOTICE 'Total de testes executados: %', v_total_testes;
  RAISE NOTICE 'Sucessos: %', v_sucessos;
  RAISE NOTICE 'Erros: %', v_erros;
  RAISE NOTICE 'Taxa de sucesso: %%%', ROUND((v_sucessos::DECIMAL / v_total_testes::DECIMAL) * 100, 2);
  RAISE NOTICE 'Agendamentos criados: %', v_total_agendamentos;
  RAISE NOTICE 'Pacientes de teste criados: 5';
  RAISE NOTICE '================================';
  
END $$;