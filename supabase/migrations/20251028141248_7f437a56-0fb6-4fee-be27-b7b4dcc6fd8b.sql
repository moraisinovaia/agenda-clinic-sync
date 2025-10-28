-- Otimização de queries de agendamentos
-- Objetivo: Reduzir latência de 2042ms para <600ms

-- Índice otimizado para queries de agendamentos futuros
CREATE INDEX IF NOT EXISTS idx_agendamentos_future_lookup 
ON agendamentos(data_agendamento, hora_agendamento, status)
WHERE excluido_em IS NULL;

-- Índice para filtros por médico
CREATE INDEX IF NOT EXISTS idx_agendamentos_medico_data
ON agendamentos(medico_id, data_agendamento)
WHERE excluido_em IS NULL;

-- Índice para status cards (hoje, amanhã)
CREATE INDEX IF NOT EXISTS idx_agendamentos_status_date
ON agendamentos(status, data_agendamento)
WHERE excluido_em IS NULL;