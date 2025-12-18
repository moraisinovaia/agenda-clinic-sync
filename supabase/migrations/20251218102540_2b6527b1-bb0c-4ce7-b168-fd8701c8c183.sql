
-- Correção final com IDs corretos das clínicas

-- 1. Popular Clínica Vênus (ID correto: 20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a)
INSERT INTO horarios_configuracao (cliente_id, medico_id, dia_semana, periodo, hora_inicio, hora_fim, intervalo_minutos, limite_pacientes, ativo)
SELECT 
  m.cliente_id,
  m.id as medico_id,
  day_name_to_number(dia.key) as dia_semana,
  classify_period((dia.value->>'inicio')::time) as periodo,
  (dia.value->>'inicio')::time as hora_inicio,
  (dia.value->>'fim')::time as hora_fim,
  COALESCE((dia.value->>'intervalo')::int, 30) as intervalo_minutos,
  COALESCE((dia.value->>'limite')::int, (dia.value->>'limite_pacientes')::int, 10) as limite_pacientes,
  true as ativo
FROM medicos m
CROSS JOIN LATERAL jsonb_each(m.horarios) AS dia(key, value)
WHERE m.ativo = true
  AND m.cliente_id = '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a'
  AND m.horarios IS NOT NULL
  AND jsonb_typeof(dia.value) = 'object'
  AND (dia.value ? 'inicio' OR dia.value ? 'fim')
  AND day_name_to_number(dia.key) >= 0;

-- 2. Popular IPADO (ID correto: 2bfb98b5-ae41-4f96-8ba7-acc797c22054) - se houver dados
INSERT INTO horarios_configuracao (cliente_id, medico_id, dia_semana, periodo, hora_inicio, hora_fim, intervalo_minutos, limite_pacientes, ativo)
SELECT DISTINCT ON (m.id, day_name_to_number(dia.key), classify_period((slot->>'inicio')::time))
  m.cliente_id,
  m.id as medico_id,
  day_name_to_number(dia.key) as dia_semana,
  classify_period((slot->>'inicio')::time) as periodo,
  MIN((slot->>'inicio')::time) OVER w as hora_inicio,
  MAX((slot->>'fim')::time) OVER w as hora_fim,
  15 as intervalo_minutos,
  COALESCE(SUM((slot->>'vagas')::int) OVER w, SUM((slot->>'limite_pacientes')::int) OVER w, 5) as limite_pacientes,
  true as ativo
FROM medicos m
CROSS JOIN LATERAL jsonb_each(m.horarios) AS dia(key, value)
CROSS JOIN LATERAL jsonb_array_elements(dia.value) AS slot
WHERE m.ativo = true
  AND m.cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054'
  AND m.horarios IS NOT NULL
  AND jsonb_typeof(dia.value) = 'array'
  AND day_name_to_number(dia.key) >= 0
WINDOW w AS (PARTITION BY m.id, day_name_to_number(dia.key), classify_period((slot->>'inicio')::time));
