
-- Migração: Popular horarios_configuracao a partir de medicos.horarios
-- Esta migração extrai os horários armazenados no JSONB e cria registros normalizados

-- 1. Limpar registros órfãos (cliente INOVAIA inativo)
DELETE FROM horarios_configuracao 
WHERE cliente_id = '2d438b24-bf74-4c30-a337-5c286110dc83';

-- 2. Criar função auxiliar para converter nome do dia em número
CREATE OR REPLACE FUNCTION day_name_to_number(day_name text)
RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CASE lower(day_name)
    WHEN 'domingo' THEN 0
    WHEN 'segunda' THEN 1
    WHEN 'terca' THEN 2
    WHEN 'terça' THEN 2
    WHEN 'quarta' THEN 3
    WHEN 'quinta' THEN 4
    WHEN 'sexta' THEN 5
    WHEN 'sabado' THEN 6
    WHEN 'sábado' THEN 6
    ELSE -1
  END;
END;
$$;

-- 3. Criar função auxiliar para classificar período
CREATE OR REPLACE FUNCTION classify_period(hora_inicio time)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  IF hora_inicio < '12:00'::time THEN
    RETURN 'manha';
  ELSIF hora_inicio < '18:00'::time THEN
    RETURN 'tarde';
  ELSE
    RETURN 'noite';
  END IF;
END;
$$;

-- 4. Popular horarios_configuracao para CLÍNICA VÊNUS (estrutura simples)
INSERT INTO horarios_configuracao (cliente_id, medico_id, dia_semana, periodo, hora_inicio, hora_fim, intervalo_minutos, limite_pacientes, ativo)
SELECT 
  m.cliente_id,
  m.id as medico_id,
  day_name_to_number(dia.key) as dia_semana,
  classify_period((dia.value->>'inicio')::time) as periodo,
  (dia.value->>'inicio')::time as hora_inicio,
  (dia.value->>'fim')::time as hora_fim,
  COALESCE((dia.value->>'intervalo')::int, 30) as intervalo_minutos,
  COALESCE((dia.value->>'limite_pacientes')::int, 10) as limite_pacientes,
  true as ativo
FROM medicos m
CROSS JOIN LATERAL jsonb_each(m.horarios) AS dia(key, value)
WHERE m.ativo = true
  AND m.cliente_id = 'e02c48a8-df81-4c84-8e1f-8c7fd4e69907' -- Clínica Vênus
  AND m.horarios IS NOT NULL
  AND jsonb_typeof(dia.value) = 'object'
  AND dia.value ? 'inicio'
  AND day_name_to_number(dia.key) >= 0;

-- 5. Popular horarios_configuracao para IPADO (estrutura com arrays)
INSERT INTO horarios_configuracao (cliente_id, medico_id, dia_semana, periodo, hora_inicio, hora_fim, intervalo_minutos, limite_pacientes, ativo)
SELECT DISTINCT ON (m.id, day_name_to_number(dia.key), classify_period((slot->>'inicio')::time))
  m.cliente_id,
  m.id as medico_id,
  day_name_to_number(dia.key) as dia_semana,
  classify_period((slot->>'inicio')::time) as periodo,
  MIN((slot->>'inicio')::time) OVER w as hora_inicio,
  MAX((slot->>'fim')::time) OVER w as hora_fim,
  COALESCE((slot->>'intervalo')::int, 15) as intervalo_minutos,
  COALESCE(SUM((slot->>'limite_pacientes')::int) OVER w, 5) as limite_pacientes,
  true as ativo
FROM medicos m
CROSS JOIN LATERAL jsonb_each(m.horarios) AS dia(key, value)
CROSS JOIN LATERAL jsonb_array_elements(dia.value) AS slot
WHERE m.ativo = true
  AND m.cliente_id = 'd4f9a3e2-93a7-4c7b-9b1e-8a5c6d7f8e9b' -- IPADO
  AND m.horarios IS NOT NULL
  AND jsonb_typeof(dia.value) = 'array'
  AND day_name_to_number(dia.key) >= 0
WINDOW w AS (PARTITION BY m.id, day_name_to_number(dia.key), classify_period((slot->>'inicio')::time));

-- 6. Popular horarios_configuracao para ENDOGASTRO (estrutura com arrays)
INSERT INTO horarios_configuracao (cliente_id, medico_id, dia_semana, periodo, hora_inicio, hora_fim, intervalo_minutos, limite_pacientes, ativo)
SELECT DISTINCT ON (m.id, day_name_to_number(dia.key), classify_period((slot->>'inicio')::time))
  m.cliente_id,
  m.id as medico_id,
  day_name_to_number(dia.key) as dia_semana,
  classify_period((slot->>'inicio')::time) as periodo,
  MIN((slot->>'inicio')::time) OVER w as hora_inicio,
  MAX((slot->>'fim')::time) OVER w as hora_fim,
  COALESCE((slot->>'intervalo')::int, 15) as intervalo_minutos,
  COALESCE(SUM((slot->>'limite_pacientes')::int) OVER w, 5) as limite_pacientes,
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
