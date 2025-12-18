-- Atualizar Dr. João Silva: adicionar ECG e prazo_retorno
UPDATE business_rules 
SET config = jsonb_build_object(
  'nome', 'Dr. João Silva',
  'especialidade', 'Cardiologista',
  'idade_minima', 0,
  'idade_maxima', null,
  'tipo_agendamento', 'hora_marcada',
  'permite_agendamento_online', true,
  'prazo_retorno_dias', 30,
  'convenios', jsonb_build_array('PARTICULAR', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED REGIONAL', 'UNIMED INTERCAMBIO', 'UNIMED NACIONAL'),
  'servicos', jsonb_build_object(
    'Consulta Cardiológica', jsonb_build_object(
      'permite_online', true,
      'valor', 300,
      'periodos', jsonb_build_object(
        'tarde_seg_qua', jsonb_build_object('dias_especificos', jsonb_build_array(1, 3), 'inicio', '14:00', 'fim', '19:00', 'limite', 10),
        'manha_sex', jsonb_build_object('dias_especificos', jsonb_build_array(5), 'inicio', '08:00', 'fim', '12:00', 'limite', 8)
      )
    ),
    'Eletrocardiograma', jsonb_build_object(
      'permite_online', true,
      'valor', 150,
      'periodos', jsonb_build_object(
        'tarde_seg_qua', jsonb_build_object('dias_especificos', jsonb_build_array(1, 3), 'inicio', '14:00', 'fim', '19:00', 'limite', 10),
        'manha_sex', jsonb_build_object('dias_especificos', jsonb_build_array(5), 'inicio', '08:00', 'fim', '12:00', 'limite', 8)
      )
    )
  )
),
updated_at = now()
WHERE id = 'f52b05fa-91a9-45aa-8e8c-e57766a97afd';

-- Atualizar Dra. Gabriela Batista: idade_minima=15, ordem_chegada (08h-10h chegada, 08:45 início), adicionar Endoscopia
UPDATE business_rules 
SET config = jsonb_build_object(
  'nome', 'Dra. Gabriela Batista',
  'especialidade', 'Gastroenterologista',
  'idade_minima', 15,
  'idade_maxima', null,
  'tipo_agendamento', 'ordem_chegada',
  'permite_agendamento_online', true,
  'prazo_retorno_dias', 20,
  'convenios', jsonb_build_array('PARTICULAR', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED REGIONAL', 'UNIMED INTERCAMBIO', 'UNIMED NACIONAL'),
  'ordem_chegada_config', jsonb_build_object(
    'hora_chegada_inicio', '08:00',
    'hora_chegada_fim', '10:00',
    'hora_atendimento_inicio', '08:45',
    'mensagem', 'Compareça entre 08h e 10h. O atendimento inicia às 08:45 por ordem de chegada.'
  ),
  'mensagem_idade_minima', 'A Dra. Gabriela atende somente pacientes a partir de 15 anos 😊',
  'servicos', jsonb_build_object(
    'Consulta Gastroenterológica', jsonb_build_object(
      'permite_online', true,
      'valor', 280,
      'periodos', jsonb_build_object(
        'ter_qui', jsonb_build_object('dias_especificos', jsonb_build_array(2, 4), 'inicio', '08:00', 'fim', '10:00', 'limite', 16),
        'sabado', jsonb_build_object('dias_especificos', jsonb_build_array(6), 'inicio', '08:00', 'fim', '10:00', 'limite', 8)
      )
    ),
    'Endoscopia Digestiva Alta', jsonb_build_object(
      'permite_online', true,
      'valor', 500,
      'requer_preparo', true,
      'periodos', jsonb_build_object(
        'ter_qui', jsonb_build_object('dias_especificos', jsonb_build_array(2, 4), 'inicio', '08:00', 'fim', '10:00', 'limite', 16),
        'sabado', jsonb_build_object('dias_especificos', jsonb_build_array(6), 'inicio', '08:00', 'fim', '10:00', 'limite', 8)
      )
    )
  )
),
updated_at = now()
WHERE id = '56c93331-b811-4994-adeb-deeef185f777';

-- Inserir mensagens personalizadas para Clínica Vênus (usando tipos válidos)
INSERT INTO llm_mensagens (cliente_id, tipo, mensagem, medico_id, ativo) VALUES
('20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a', 'ordem_chegada', 'Compareça entre 08h e 10h. O atendimento inicia às 08:45 por ordem de chegada. 🕐', '4361d620-4c9b-4602-aab1-e835cc63c8a2', true),
('20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a', 'boas_vindas', 'Olá! 👋 Sou a Noah, assistente virtual da Clínica Vênus. Como posso ajudar?', null, true)
ON CONFLICT DO NOTHING;