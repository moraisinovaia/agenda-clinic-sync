-- =====================================================
-- CONFIGURAÇÃO DR. SYDNEY RIBEIRO - ENDOGASTRO
-- =====================================================

-- 1. Criar Atendimentos
INSERT INTO public.atendimentos (medico_id, cliente_id, nome, tipo, valor_particular, ativo)
VALUES
  ('5617c20f-5f3d-4e1f-924c-e624a6b8852b', '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 
   'Consulta Gastroenterológica', 'consulta', 300.00, true),
  ('5617c20f-5f3d-4e1f-924c-e624a6b8852b', '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 
   'Endoscopia (EDA)', 'exame', 500.00, true),
  ('5617c20f-5f3d-4e1f-924c-e624a6b8852b', '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 
   'Colonoscopia', 'exame', 800.00, true),
  ('5617c20f-5f3d-4e1f-924c-e624a6b8852b', '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 
   'Musectomia', 'procedimento', 500.00, true),
  ('5617c20f-5f3d-4e1f-924c-e624a6b8852b', '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 
   'Ligadura', 'procedimento', 500.00, true),
  ('5617c20f-5f3d-4e1f-924c-e624a6b8852b', '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 
   'Polipectomia', 'procedimento', 500.00, true),
  ('5617c20f-5f3d-4e1f-924c-e624a6b8852b', '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 
   'Dilatação', 'procedimento', 500.00, true),
  ('5617c20f-5f3d-4e1f-924c-e624a6b8852b', '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 
   'Balão Intragástrico', 'procedimento', 2000.00, true);

-- 2. Atualizar observações do médico
UPDATE public.medicos
SET 
  idade_minima = 12,
  observacoes = 'IDADES MÍNIMAS: Consulta 12 anos | EDA 13 anos | Colonoscopia 15 anos. CONVÊNIOS: Unimed, Bradesco, Postal, Mineração, FACHESF (exceto nº 43), FUSEX, Camed, Assefaz, Codevasf, Cassic, Cassi, Asfeb, Compesa, Casseb, CapSaúde, Particular. PAGAMENTO PARTICULAR: Espécie, PIX ou 2x cartão. PROCEDIMENTOS: Colonoscopia, Musectomia, Ligadura, Polipectomia, Dilatação, Balão Intragástrico. AGENDA: Segunda (Consultas Convênio 15h/16h) | Terça/Quarta (EDA 7h + Colono 9:30-12h) | Sexta (EDA 7h + Consulta Particular 11h/12h). COLONOSCOPIA +60 ANOS: Sempre às 09:30.'
WHERE id = '5617c20f-5f3d-4e1f-924c-e624a6b8852b';

-- 3. Atualizar Business Rules - idade_minima como inteiro para o trigger
UPDATE public.business_rules
SET config = jsonb_build_object(
  'idade_minima', 12,
  'idades_por_servico', jsonb_build_object(
    'consulta', 12,
    'endoscopia', 13,
    'colonoscopia', 15
  ),
  'convenios_aceitos', ARRAY['Unimed', 'Bradesco', 'Postal', 'Mineração', 'FACHESF', 'FUSEX', 'Camed', 'Assefaz', 'Codevasf', 'Cassic', 'Cassi', 'Asfeb', 'Compesa', 'Casseb', 'CapSaúde', 'Particular'],
  'restricoes_convenio', jsonb_build_object(
    'FACHESF', jsonb_build_object(
      'carteira_bloqueada_prefixo', '43',
      'mensagem', 'Infelizmente o Dr. Sydney não atende carteiras FACHESF que começam com 43.'
    )
  ),
  'forma_pagamento', jsonb_build_object(
    'particular', jsonb_build_object(
      'opcoes', ARRAY['Espécie', 'PIX', '2x no cartão'],
      'mensagem', 'Para consultas e exames particulares, aceitamos pagamento em espécie, PIX ou parcelado em 2x no cartão.'
    )
  ),
  'colonoscopia_60_anos', jsonb_build_object(
    'horario_especial', '09:30',
    'regra', 'Pacientes acima de 60 anos devem ser agendados às 09:30 (primeiro horário)',
    'mensagem', 'Para pacientes acima de 60 anos, a colonoscopia é agendada às 09:30.'
  ),
  'procedimentos', ARRAY['Colonoscopia', 'Musectomia', 'Ligadura', 'Polipectomia', 'Dilatação', 'Balão Intragástrico'],
  'servicos', jsonb_build_object(
    'consulta_convenio', jsonb_build_object(
      'nome', 'Consulta Gastroenterológica (Convênio)',
      'tipo_agendamento', 'ordem_chegada',
      'idade_minima', 12,
      'aceita_particular', false,
      'dias', ARRAY[1],
      'horarios', jsonb_build_object(
        'turno1', jsonb_build_object(
          'inicio', '15:00',
          'limite', 6,
          'ficha', '30 minutos antes',
          'chegada', '15:30'
        ),
        'turno2', jsonb_build_object(
          'inicio', '16:00',
          'limite', 6,
          'ficha', '15 minutos antes',
          'chegada', '16:30'
        )
      ),
      'limite_total', 12,
      'mensagem', 'Consultas do Dr. Sydney às segundas-feiras às 15h ou 16h. Chegue 30 minutos antes para o primeiro horário e 15 minutos antes para o segundo.'
    ),
    'consulta_particular', jsonb_build_object(
      'nome', 'Consulta Gastroenterológica (Particular)',
      'tipo_agendamento', 'ordem_chegada',
      'idade_minima', 12,
      'somente_particular', true,
      'dias', ARRAY[5],
      'horarios', jsonb_build_object(
        'turno1', jsonb_build_object(
          'inicio', '11:00',
          'limite', 5,
          'ficha', '15 minutos antes',
          'chegada', '11:40'
        ),
        'turno2', jsonb_build_object(
          'inicio', '12:00',
          'limite', 5,
          'ficha', '15 minutos antes',
          'chegada', '12:00'
        )
      ),
      'limite_total', 10,
      'mensagem', 'Consultas particulares do Dr. Sydney às sextas-feiras às 11h ou 12h. Chegue 15 minutos antes do seu horário.'
    ),
    'endoscopia', jsonb_build_object(
      'nome', 'Endoscopia (EDA)',
      'tipo_agendamento', 'ordem_chegada',
      'idade_minima', 13,
      'dias', ARRAY[2, 3, 5],
      'horarios', jsonb_build_object(
        'manha', jsonb_build_object(
          'inicio', '07:00',
          'limite', 12,
          'ficha', 'Das 7h às 9h',
          'fim_ficha', '09:00'
        )
      ),
      'limite_total', 12,
      'mensagem', 'Endoscopias do Dr. Sydney às terças, quartas e sextas a partir das 7h. Chegue entre 7h e 9h para retirada de ficha.'
    ),
    'colonoscopia', jsonb_build_object(
      'nome', 'Colonoscopia',
      'tipo_agendamento', 'hora_marcada',
      'idade_minima', 15,
      'dias', ARRAY[2, 3],
      'horarios', jsonb_build_object(
        'manha', jsonb_build_object(
          'horario_60_anos', '09:30',
          'horarios_demais', ARRAY['10:00', '10:30', '11:00', '11:30', '12:00'],
          'limite_60_anos', 1,
          'limite_demais', 5
        )
      ),
      'regra_especial', 'Pacientes +60 anos: agendar às 09:30. Demais: 10:00 às 12:00.',
      'limite_total', 6,
      'mensagem', 'Colonoscopias do Dr. Sydney às terças e quartas. Pacientes acima de 60 anos: agendar às 09:30. Demais pacientes: horários às 10:00, 10:30, 11:00, 11:30 ou 12:00.'
    )
  ),
  'mensagens', jsonb_build_object(
    'restricao_fachesf', 'Infelizmente o Dr. Sydney não atende carteiras FACHESF que começam com 43.',
    'idade_minima_consulta', 'O Dr. Sydney atende pacientes a partir de 12 anos para consultas.',
    'idade_minima_eda', 'O Dr. Sydney realiza endoscopia em pacientes a partir de 13 anos.',
    'idade_minima_colono', 'O Dr. Sydney realiza colonoscopia em pacientes a partir de 15 anos.',
    'pagamento_particular', 'Para atendimento particular, aceitamos espécie, PIX ou parcelamento em 2x no cartão.',
    'sexta_particular', 'Às sextas-feiras, as consultas do Dr. Sydney são apenas particulares.',
    'colono_60_anos', 'Para pacientes acima de 60 anos, agendamos a colonoscopia às 09:30, primeiro horário da manhã.'
  ),
  'observacoes', 'Dr. Sydney realiza também: Musectomia, Ligadura, Polipectomia, Dilatação e Balão Intragástrico.'
)
WHERE medico_id = '5617c20f-5f3d-4e1f-924c-e624a6b8852b';