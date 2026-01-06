-- Atualizar business_rules do Dr. Diego Tomás
UPDATE public.business_rules 
SET config = jsonb_build_object(
  'servicos', jsonb_build_object(
    'Consulta Cardiológica', jsonb_build_object(
      'valor_particular', 280,
      'idade_minima', 15,
      'dias_atendimento', jsonb_build_array('segunda', 'sexta'),
      'periodos', jsonb_build_object()
    ),
    'ECG', jsonb_build_object(
      'valor_particular', 80,
      'coparticipacao_unimed', jsonb_build_object('20', 4.65, '40', 9.30),
      'agendar_na_agenda', 'JOANA',
      'limite_diario', 7,
      'horarios_manha', '08:30-09:00',
      'horarios_tarde', '13:30-15:00'
    ),
    'MAPA', jsonb_build_object(
      'valor_particular', 220,
      'agendar_na_agenda', 'JOANA',
      'horario_instalacao', '08:00',
      'dias_atendimento', jsonb_build_object(
        'segunda', 2,
        'sexta', 4
      ),
      'restricoes', jsonb_build_array('Não agendar antes de feriado', 'Sem hemodiálise no mesmo dia', 'Retirar aparelho no dia seguinte')
    ),
    'HOLTER', jsonb_build_object(
      'valor_particular', 220,
      'agendar_na_agenda', 'JOANA',
      'horario_instalacao', '08:00',
      'dias_atendimento', jsonb_build_object(
        'terca', 2
      ),
      'restricoes', jsonb_build_array('Não agendar antes de feriado', 'Sem hemodiálise no mesmo dia', 'Retirar aparelho no dia seguinte')
    ),
    'TESTE ERGOMÉTRICO', jsonb_build_object(
      'valor_particular', 250,
      'coparticipacao_unimed', jsonb_build_object('20', 26.69, '40', 53.38),
      'idade_minima', 18,
      'peso_maximo_kg', 150
    ),
    'ECO', jsonb_build_object(
      'valor_particular', 300,
      'idade_minima', 18,
      'nome_tecnico', 'Ecocardiograma Transtorácico (ECOTT)'
    )
  ),
  'restricoes', jsonb_build_object(
    'nao_mistura_exames', true,
    'consulta_ecg_permitido', true,
    'ordem_agendamento', 'exames_primeiro_depois_consultas',
    'observacao', 'NÃO misturar consultas com exames (exceto Consulta + ECG). Agendar exames primeiro, depois consultas.'
  ),
  'pacotes_especiais', jsonb_build_array(
    jsonb_build_object(
      'nome', 'ECG + Consulta',
      'servicos', jsonb_build_array('ECG', 'Consulta Cardiológica'),
      'valor', 350,
      'economia', 10
    )
  ),
  'entrega_resultados', jsonb_build_object(
    'Holter', jsonb_build_object('prazo_dias', 3, 'tipo', 'dias_uteis'),
    'MAPA', jsonb_build_object('prazo_dias', 5, 'tipo', 'dias_uteis', 'observacao', 'Depende do dia que médico estiver na clínica'),
    'ECO', jsonb_build_object('prazo_dias', 0, 'tipo', 'mesmo_dia'),
    'TESTE ERGOMÉTRICO', jsonb_build_object('prazo_dias', 0, 'tipo', 'mesmo_dia'),
    'ECG', jsonb_build_object('prazo_dias', 3, 'tipo', 'dias_uteis', 'observacao', 'Se médico estiver na clínica, libera no mesmo dia')
  )
),
updated_at = now()
WHERE medico_id = '04505052-89c5-4090-9921-806a6fc7b544';

-- Atualizar business_rules do Dr. Heverson Alex
UPDATE public.business_rules 
SET config = jsonb_build_object(
  'servicos', jsonb_build_object(
    'Consulta Cardiológica', jsonb_build_object(
      'valor_particular', 280,
      'idade_minima', 15,
      'dias_atendimento', jsonb_build_array('terca', 'quinta')
    ),
    'ECG', jsonb_build_object(
      'valor_particular', 80,
      'coparticipacao_unimed', jsonb_build_object('20', 4.65, '40', 9.30),
      'agendar_na_agenda', 'JOANA',
      'limite_diario', 7,
      'horarios_manha', '08:30-09:00',
      'horarios_tarde', '13:30-15:00'
    ),
    'MAPA', jsonb_build_object(
      'valor_particular', 220,
      'agendar_na_agenda', 'JOANA',
      'horario_instalacao', '08:00',
      'dias_atendimento', jsonb_build_object(
        'terca', 2,
        'quinta', 2
      ),
      'restricoes', jsonb_build_array('Não agendar antes de feriado', 'Sem hemodiálise no mesmo dia', 'Retirar aparelho no dia seguinte')
    ),
    'HOLTER', jsonb_build_object(
      'valor_particular', 220,
      'agendar_na_agenda', 'JOANA',
      'horario_instalacao', '08:00',
      'dias_atendimento', jsonb_build_object(
        'quinta', 2
      ),
      'restricoes', jsonb_build_array('Não agendar antes de feriado', 'Sem hemodiálise no mesmo dia', 'Retirar aparelho no dia seguinte')
    ),
    'TESTE ERGOMÉTRICO', jsonb_build_object(
      'valor_particular', 250,
      'coparticipacao_unimed', jsonb_build_object('20', 26.69, '40', 53.38),
      'idade_minima', 18,
      'peso_maximo_kg', 150
    )
  ),
  'exames_nao_realizados', jsonb_build_array('ECO', 'Ecocardiograma'),
  'restricoes', jsonb_build_object(
    'nao_mistura_exames', true,
    'consulta_ecg_permitido', true,
    'ordem_agendamento', 'exames_primeiro_depois_consultas',
    'observacao', 'NÃO misturar consultas com exames (exceto Consulta + ECG). Agendar exames primeiro, depois consultas. NÃO FAZ Ecocardiograma.'
  ),
  'pacotes_especiais', jsonb_build_array(
    jsonb_build_object(
      'nome', 'ECG + Consulta',
      'servicos', jsonb_build_array('ECG', 'Consulta Cardiológica'),
      'valor', 350,
      'economia', 10
    )
  ),
  'entrega_resultados', jsonb_build_object(
    'Holter', jsonb_build_object('prazo_dias', 3, 'tipo', 'dias_uteis'),
    'MAPA', jsonb_build_object('prazo_dias', 5, 'tipo', 'dias_uteis', 'observacao', 'Depende do dia que médico estiver na clínica'),
    'TESTE ERGOMÉTRICO', jsonb_build_object('prazo_dias', 0, 'tipo', 'mesmo_dia'),
    'ECG', jsonb_build_object('prazo_dias', 3, 'tipo', 'dias_uteis', 'observacao', 'Se médico estiver na clínica, libera no mesmo dia')
  )
),
updated_at = now()
WHERE medico_id = 'fdb7862c-e83d-4294-a36c-a61f177c9487';

-- Atualizar business_rules do Dr. Max Koki
UPDATE public.business_rules 
SET config = jsonb_build_object(
  'servicos', jsonb_build_object(
    'Consulta Cardiológica', jsonb_build_object(
      'valor_particular', 280,
      'idade_minima', 15,
      'dias_atendimento', jsonb_build_array('terca', 'quinta')
    ),
    'ECG', jsonb_build_object(
      'valor_particular', 80,
      'coparticipacao_unimed', jsonb_build_object('20', 4.65, '40', 9.30),
      'agendar_na_agenda', 'JOANA',
      'limite_diario', 7,
      'horarios_manha', '08:30-09:00',
      'horarios_tarde', '13:30-15:00'
    ),
    'MAPA', jsonb_build_object(
      'valor_particular', 220,
      'agendar_na_agenda', 'JOANA',
      'horario_instalacao', '08:00',
      'dias_atendimento', jsonb_build_object(
        'terca', 2,
        'quinta', 2
      ),
      'restricoes', jsonb_build_array('Não agendar antes de feriado', 'Sem hemodiálise no mesmo dia', 'Retirar aparelho no dia seguinte')
    ),
    'HOLTER', jsonb_build_object(
      'valor_particular', 220,
      'agendar_na_agenda', 'JOANA',
      'horario_instalacao', '08:00',
      'dias_atendimento', jsonb_build_object(
        'quarta', 2
      ),
      'restricoes', jsonb_build_array('Não agendar antes de feriado', 'Sem hemodiálise no mesmo dia', 'Retirar aparelho no dia seguinte')
    ),
    'TESTE ERGOMÉTRICO', jsonb_build_object(
      'valor_particular', 250,
      'coparticipacao_unimed', jsonb_build_object('20', 26.69, '40', 53.38),
      'idade_minima', 18,
      'peso_maximo_kg', 150
    )
  ),
  'exames_nao_realizados', jsonb_build_array('ECO', 'Ecocardiograma'),
  'restricoes', jsonb_build_object(
    'nao_mistura_exames', true,
    'consulta_ecg_permitido', true,
    'ordem_agendamento', 'exames_primeiro_depois_consultas',
    'observacao', 'NÃO misturar consultas com exames (exceto Consulta + ECG). Agendar exames primeiro, depois consultas. NÃO FAZ Ecocardiograma.'
  ),
  'pacotes_especiais', jsonb_build_array(
    jsonb_build_object(
      'nome', 'ECG + Consulta',
      'servicos', jsonb_build_array('ECG', 'Consulta Cardiológica'),
      'valor', 350,
      'economia', 10
    )
  ),
  'entrega_resultados', jsonb_build_object(
    'Holter', jsonb_build_object('prazo_dias', 3, 'tipo', 'dias_uteis'),
    'MAPA', jsonb_build_object('prazo_dias', 5, 'tipo', 'dias_uteis', 'observacao', 'Depende do dia que médico estiver na clínica'),
    'TESTE ERGOMÉTRICO', jsonb_build_object('prazo_dias', 0, 'tipo', 'mesmo_dia'),
    'ECG', jsonb_build_object('prazo_dias', 3, 'tipo', 'dias_uteis', 'observacao', 'Se médico estiver na clínica, libera no mesmo dia')
  )
),
updated_at = now()
WHERE medico_id = '84f434dc-21f6-41a9-962e-9b0722a0e2d4';