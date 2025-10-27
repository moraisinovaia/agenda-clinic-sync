-- ========================================
-- ÍNDICES OTIMIZADOS PARA PERFORMANCE
-- ========================================

-- Índice principal para listagem ordenada (data DESC)
CREATE INDEX IF NOT EXISTS idx_agendamentos_listagem 
  ON agendamentos(data_agendamento DESC, hora_agendamento DESC) 
  WHERE excluido_em IS NULL;

-- Índice para filtros por médico
CREATE INDEX IF NOT EXISTS idx_agendamentos_medico 
  ON agendamentos(medico_id, data_agendamento DESC) 
  WHERE excluido_em IS NULL;

-- Índice para filtros por status
CREATE INDEX IF NOT EXISTS idx_agendamentos_status 
  ON agendamentos(status, data_agendamento DESC) 
  WHERE excluido_em IS NULL;

-- Índice composto para queries complexas (filtros combinados)
CREATE INDEX IF NOT EXISTS idx_agendamentos_lookup 
  ON agendamentos(data_agendamento DESC, medico_id, status) 
  WHERE excluido_em IS NULL;

-- Comentários explicativos
COMMENT ON INDEX idx_agendamentos_listagem IS 'Otimiza listagem geral ordenada por data/hora';
COMMENT ON INDEX idx_agendamentos_medico IS 'Otimiza filtros por médico';
COMMENT ON INDEX idx_agendamentos_status IS 'Otimiza filtros por status';
COMMENT ON INDEX idx_agendamentos_lookup IS 'Otimiza queries com múltiplos filtros';