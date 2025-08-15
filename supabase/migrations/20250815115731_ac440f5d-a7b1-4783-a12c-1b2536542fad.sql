-- Limpar fila de espera de testes primeiro
DELETE FROM public.fila_espera 
WHERE paciente_id IN (
  SELECT id FROM public.pacientes 
  WHERE nome_completo ILIKE '%teste%' 
     OR nome_completo ILIKE '%test%'
);

-- Limpar agendamentos de teste anteriores
DELETE FROM public.agendamentos 
WHERE observacoes ILIKE '%teste%' 
   OR observacoes ILIKE '%test%'
   OR criado_por ILIKE '%teste%'
   OR criado_por ILIKE '%test%';

-- Limpar pacientes de teste que não têm mais agendamentos
DELETE FROM public.pacientes 
WHERE nome_completo ILIKE '%teste%' 
   OR nome_completo ILIKE '%test%'
   AND NOT EXISTS (
     SELECT 1 FROM public.agendamentos 
     WHERE paciente_id = pacientes.id
   );

-- Inserir um agendamento de teste para verificar o webhook N8N
DO $$
DECLARE
  v_paciente_id UUID;
  v_medico_id UUID;
  v_atendimento_id UUID;
  v_agendamento_id UUID;
BEGIN
  -- Buscar o primeiro médico ativo
  SELECT id INTO v_medico_id FROM public.medicos WHERE ativo = true LIMIT 1;
  
  -- Buscar o primeiro atendimento ativo
  SELECT id INTO v_atendimento_id FROM public.atendimentos WHERE ativo = true LIMIT 1;
  
  -- Criar paciente de teste
  INSERT INTO public.pacientes (
    nome_completo, 
    data_nascimento, 
    convenio, 
    celular
  ) VALUES (
    'João Teste Webhook N8N',
    '1990-01-15',
    'Particular',
    '(87) 99131-1991'
  ) RETURNING id INTO v_paciente_id;
  
  -- Criar agendamento de teste
  INSERT INTO public.agendamentos (
    paciente_id,
    medico_id,
    atendimento_id,
    data_agendamento,
    hora_agendamento,
    convenio,
    observacoes,
    criado_por,
    status
  ) VALUES (
    v_paciente_id,
    v_medico_id,
    v_atendimento_id,
    CURRENT_DATE + INTERVAL '7 days',
    '14:30:00',
    'Particular',
    'TESTE WEBHOOK N8N - Agendamento criado para verificar funcionamento do sistema automático',
    'Sistema - Teste N8N',
    'agendado'
  ) RETURNING id INTO v_agendamento_id;
  
  -- Log do teste criado
  INSERT INTO public.system_logs (
    timestamp,
    level,
    message,
    context,
    data
  ) VALUES (
    now(),
    'info',
    'Agendamento de teste N8N criado',
    'N8N_TEST',
    jsonb_build_object(
      'agendamento_id', v_agendamento_id,
      'paciente_id', v_paciente_id,
      'teste', 'webhook_n8n'
    )
  );
  
  RAISE NOTICE 'Agendamento de teste criado: %', v_agendamento_id;
END $$;