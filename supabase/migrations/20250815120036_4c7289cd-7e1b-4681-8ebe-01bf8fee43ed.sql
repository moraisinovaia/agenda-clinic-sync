-- Criar um novo agendamento de teste para verificar o webhook N8N atualizado
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
    'Maria Teste N8N Webhook',
    '1985-03-20',
    'Unimed',
    '(87) 98888-9999'
  ) RETURNING id INTO v_paciente_id;
  
  -- Criar agendamento de teste com novo webhook
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
    CURRENT_DATE + INTERVAL '10 days',
    '15:00:00',
    'Unimed',
    'TESTE N8N WEBHOOK ATUALIZADO - Verificação da nova URL do webhook',
    'Recepcionista - Teste',
    'agendado'
  ) RETURNING id INTO v_agendamento_id;
  
  -- Log do novo teste
  INSERT INTO public.system_logs (
    timestamp,
    level,
    message,
    context,
    data
  ) VALUES (
    now(),
    'info',
    'Novo agendamento de teste criado com webhook N8N atualizado',
    'N8N_WEBHOOK_TEST',
    jsonb_build_object(
      'agendamento_id', v_agendamento_id,
      'paciente_id', v_paciente_id,
      'webhook_url', 'https://n8n.inovaia.online/webhook-test/whatsapp-webhook',
      'teste_tipo', 'webhook_atualizado'
    )
  );
  
  RAISE NOTICE 'Novo agendamento de teste criado: % para URL: https://n8n.inovaia.online/webhook-test/whatsapp-webhook', v_agendamento_id;
END $$;