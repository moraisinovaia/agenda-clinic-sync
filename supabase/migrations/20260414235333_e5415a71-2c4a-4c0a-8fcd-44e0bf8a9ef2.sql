
DO $$
DECLARE
  v_cliente_id uuid := '0b6a0a35-0059-4a0c-9fb8-413b6253c2ad';
  v_medico_id uuid;
  v_atendimento_id uuid;
  v_config_id uuid;
BEGIN
  -- 1. Insert médica
  INSERT INTO public.medicos (
    cliente_id, nome, especialidade, crm, rqe, ativo,
    idade_minima, idade_maxima, atende_criancas, atende_adultos,
    convenios_aceitos
  ) VALUES (
    v_cliente_id,
    'DRA MARIA SUELY AMORIM MENDES',
    'Oftalmologia',
    '11736 PE',
    '6098',
    true,
    0, NULL, true, true,
    ARRAY['PARTICULAR','UNIMED NACIONAL','UNIMED REGIONAL','UNIMED 20%','UNIMED 40%','AMIL','HAPVIDA','MEDPREV','HGU','SELECT']
  ) RETURNING id INTO v_medico_id;

  -- 2. Insert atendimento (Consulta)
  INSERT INTO public.atendimentos (
    cliente_id, medico_id, nome, tipo, ativo,
    valor_particular, coparticipacao_unimed_20, coparticipacao_unimed_40,
    forma_pagamento, medico_nome
  ) VALUES (
    v_cliente_id, v_medico_id,
    'Consulta', 'consulta', true,
    350.00, 38.00, 78.00,
    'Dinheiro, Cartão, PIX',
    'DRA MARIA SUELY AMORIM MENDES'
  ) RETURNING id INTO v_atendimento_id;

  -- 3. Insert llm_clinic_config (if not exists)
  INSERT INTO public.llm_clinic_config (
    cliente_id, nome_clinica, telefone, whatsapp
  ) VALUES (
    v_cliente_id, 'PROOFTALMO', '87 3861.6214', '87 98843.8731'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_config_id;

  IF v_config_id IS NULL THEN
    SELECT id INTO v_config_id FROM public.llm_clinic_config WHERE cliente_id = v_cliente_id LIMIT 1;
  END IF;

  -- 4. Insert business_rules
  INSERT INTO public.business_rules (
    cliente_id, medico_id, config, config_id, ativo
  ) VALUES (
    v_cliente_id, v_medico_id,
    jsonb_build_object(
      'tipo_agendamento', 'hora_marcada',
      'permite_agendamento_online', false,
      'idade_minima', 0,
      'idade_maxima', null,
      'atende_criancas', true,
      'atende_adultos', true,
      'convenios', ARRAY['PARTICULAR','UNIMED NACIONAL','UNIMED REGIONAL','UNIMED 20%','UNIMED 40%','AMIL','HAPVIDA','MEDPREV','HGU','SELECT'],
      'servicos', jsonb_build_array(
        jsonb_build_object(
          'nome', 'Consulta',
          'tipo', 'consulta',
          'permite_online', false,
          'dias_atendimento', ARRAY[1,2,3,4,5],
          'periodos', jsonb_build_object(
            'manha', jsonb_build_object(
              'ativo', true,
              'horario_inicio', '09:00',
              'horario_fim', '12:00',
              'limite_pacientes', 12
            ),
            'tarde', jsonb_build_object(
              'ativo', true,
              'horario_inicio', '14:30',
              'horario_fim', '17:30',
              'limite_pacientes', 8
            ),
            'noite', jsonb_build_object(
              'ativo', false,
              'horario_inicio', '18:00',
              'horario_fim', '21:00',
              'limite_pacientes', 0
            )
          )
        )
      )
    ),
    v_config_id,
    true
  );

  -- 5. Insert LLM mensagens (usando tipos válidos do check constraint)
  INSERT INTO public.llm_mensagens (cliente_id, medico_id, config_id, tipo, mensagem, ativo) VALUES
    (v_cliente_id, v_medico_id, v_config_id, 'boas_vindas',
     'Olá, Bem vindos a PROOFTALMO! Dra Suely Amorim agradece seu contato, em que podemos te ajudar?', true),
    (v_cliente_id, v_medico_id, v_config_id, 'encaixe',
     'Em caso de URGÊNCIA entrar em contato pelo telefone 87 3861.6214', true),
    (v_cliente_id, v_medico_id, v_config_id, 'pagamento',
     'Aceitamos Cartão de Crédito/Débito, PIX ou Dinheiro', true),
    (v_cliente_id, v_medico_id, v_config_id, 'hora_marcada',
     'Nosso atendimento é por ordem de chegada, favor chegar 15 min antes do horário marcado e nossa tolerância é de 30 min após o horário marcado.', true);

END $$;
