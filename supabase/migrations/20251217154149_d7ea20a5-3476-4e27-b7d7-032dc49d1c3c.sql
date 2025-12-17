-- FASE 5: ADICIONAR CLIENTE_ID EM TABELAS FALTANTES

-- 1. Adicionar cliente_id em audit_logs (derivado do agendamento/profile)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id);

-- Atualizar audit_logs existentes baseado nos agendamentos
UPDATE audit_logs al
SET cliente_id = a.cliente_id
FROM agendamentos a
WHERE al.table_name = 'agendamentos' 
  AND al.record_id = a.id
  AND al.cliente_id IS NULL;

-- 2. Adicionar cliente_id em fila_notificacoes (derivado da fila_espera)
ALTER TABLE fila_notificacoes ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id);

-- Atualizar fila_notificacoes existentes
UPDATE fila_notificacoes fn
SET cliente_id = fe.cliente_id
FROM fila_espera fe
WHERE fn.fila_id = fe.id
  AND fn.cliente_id IS NULL;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_cliente ON audit_logs(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fila_notificacoes_cliente ON fila_notificacoes(cliente_id);