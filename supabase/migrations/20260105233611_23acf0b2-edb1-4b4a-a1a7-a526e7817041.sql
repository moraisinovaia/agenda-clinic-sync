
-- Inserir horarios_configuracao para Dr. Edson Batista da IPADO
-- cliente_id correto: 2bfb98b5-ae41-4f96-8ba7-acc797c22054
-- Terça-feira (dia_semana = 2): Exames (08:00-09:00) e Consultas (09:30-10:00)

INSERT INTO horarios_configuracao (
  cliente_id, medico_id, dia_semana, periodo, hora_inicio, hora_fim, limite_pacientes, intervalo_minutos, ativo
)
VALUES 
  -- Exames: 08:00-09:00
  (
    '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
    'cdbfc594-d3de-459f-a9c1-a3f29842273e',
    2, 'manha', '08:00', '09:00', 15, 15, true
  ),
  -- Consultas/Retornos: 09:30-10:00
  (
    '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
    'cdbfc594-d3de-459f-a9c1-a3f29842273e',
    2, 'manha', '09:30', '10:00', 10, 15, true
  )
ON CONFLICT DO NOTHING;
