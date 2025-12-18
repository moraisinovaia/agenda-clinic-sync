-- Atualizar business_rules do Dr. Sydney Ribeiro com configuração completa
UPDATE public.business_rules
SET 
  config = jsonb_build_object(
    'nome', 'Dr. Sydney Ribeiro',
    'idade_minima', 18,
    'tipo_agendamento', 'misto',
    'permite_agendamento_online', true,
    'convenios', jsonb_build_array(
      'BRADESCO', 'POSTAL MINERAÇÃO', 'FACHESF', 'FUSEX', 
      'CAMED', 'ASSEFAZ', 'CODEVASF', 'CASSIC', 'CASSI', 
      'ASFEB', 'COMPESA', 'CASSEB', 'CAPSAÚDE', 'PARTICULAR', 
      'UNIMED NACIONAL', 'UNIMED REGIONAL', 
      'UNIMED COPARTICIPAÇÃO 40%', 'UNIMED COPARTICIPAÇÃO 20%', 
      'UNIMED INTERCÂMBIO'
    ),
    'servicos', jsonb_build_object(
      'Endoscopia Digestiva Alta', jsonb_build_object(
        'tipo', 'ordem_chegada',
        'permite_online', true,
        'dias_semana', jsonb_build_array(1, 4),
        'periodos', jsonb_build_object(
          'manha', jsonb_build_object(
            'inicio', '07:00',
            'fim', '09:00',
            'distribuicao_fichas', '07:00 às 09:00',
            'atendimento_inicio', '08:00',
            'limite', null
          )
        )
      ),
      'Colonoscopia', jsonb_build_object(
        'tipo', 'hora_marcada',
        'permite_online', true,
        'dias_semana', jsonb_build_array(1, 4),
        'intervalo_minutos', 20,
        'periodos', jsonb_build_object(
          'manha', jsonb_build_object(
            'inicio', '10:00',
            'fim', '12:00',
            'limite', 6
          )
        )
      ),
      'Colono + EDA', jsonb_build_object(
        'tipo', 'hora_marcada',
        'permite_online', true,
        'dias_semana', jsonb_build_array(1, 4),
        'intervalo_minutos', 20,
        'compartilha_limite_com', 'Colonoscopia'
      ),
      'Polipectomia do Cólon', jsonb_build_object(
        'tipo', 'hora_marcada',
        'permite_online', true,
        'dias_semana', jsonb_build_array(1, 4),
        'intervalo_minutos', 20,
        'compartilha_limite_com', 'Colonoscopia'
      ),
      'Polipectomia Gástrica', jsonb_build_object(
        'tipo', 'ordem_chegada',
        'permite_online', true,
        'dias_semana', jsonb_build_array(1, 4),
        'compartilha_preparo_com', 'Endoscopia Digestiva Alta'
      ),
      'Retossigmoidoscopia', jsonb_build_object(
        'tipo', 'hora_marcada',
        'permite_online', true,
        'dias_semana', jsonb_build_array(1, 4),
        'intervalo_minutos', 20,
        'compartilha_limite_com', 'Colonoscopia'
      ),
      'Consulta Gastroenterológica', jsonb_build_object(
        'tipo', 'hora_marcada',
        'permite_online', true,
        'dias_semana', jsonb_build_array(2, 4),
        'intervalo_minutos', 30,
        'periodos', jsonb_build_object(
          'tarde', jsonb_build_object(
            'inicio', '13:00',
            'fim', '17:00',
            'limite', 7
          )
        )
      ),
      'Retorno Gastroenterológico', jsonb_build_object(
        'tipo', 'hora_marcada',
        'permite_online', true,
        'dias_semana', jsonb_build_array(2, 4),
        'intervalo_minutos', 30,
        'compartilha_limite_com', 'Consulta Gastroenterológica'
      )
    )
  ),
  updated_at = now(),
  version = version + 1
WHERE id = '0e0857b5-f41e-47b9-a8f7-7ccf204758f7';