
-- Correção: limpar e repopular com campos corretos

-- 1. Limpar registros anteriores (exceto IPADO que não tem dados de horário no JSONB)
DELETE FROM horarios_configuracao;

-- 2. Popular Clínica Vênus (usa campo "limite" e estrutura simples)
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
  AND m.cliente_id = 'e02c48a8-df81-4c84-8e1f-8c7fd4e69907' -- Clínica Vênus
  AND m.horarios IS NOT NULL
  AND jsonb_typeof(dia.value) = 'object'
  AND (dia.value ? 'inicio' OR dia.value ? 'fim')
  AND day_name_to_number(dia.key) >= 0;

-- 3. Popular ENDOGASTRO (usa campo "vagas" e estrutura com arrays)
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
  AND m.cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253' -- ENDOGASTRO
  AND m.horarios IS NOT NULL
  AND jsonb_typeof(dia.value) = 'array'
  AND day_name_to_number(dia.key) >= 0
WINDOW w AS (PARTITION BY m.id, day_name_to_number(dia.key), classify_period((slot->>'inicio')::time));
