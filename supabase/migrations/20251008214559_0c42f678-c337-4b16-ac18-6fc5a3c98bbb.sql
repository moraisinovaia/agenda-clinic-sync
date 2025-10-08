-- ✅ TESTE: Criar configuração de horário para Dra. Adriana (quinta-feira)

INSERT INTO public.horarios_configuracao (
  medico_id,
  cliente_id,
  dia_semana,
  periodo,
  hora_inicio,
  hora_fim,
  intervalo_minutos,
  ativo
) VALUES (
  '32d30887-b876-4502-bf04-e55d7fb55b50', -- Dra. Adriana Carla de Sena
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054', -- Cliente IPADO
  4, -- Quinta-feira (09/10/2025)
  'manha',
  '08:00',
  '12:00',
  15, -- Intervalo de 15 minutos
  true
);

-- Log da criação
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 
  'info',
  '[TEST] Configuração de horário criada para teste de geração',
  'SCHEDULE_CONFIG_TEST',
  jsonb_build_object(
    'medico', 'Dra. Adriana Carla de Sena',
    'dia_semana', 4,
    'periodo', 'manha',
    'horario', '08:00-12:00',
    'intervalo', 15,
    'slots_esperados', 16,
    'data_teste', '2025-10-09'
  )
);