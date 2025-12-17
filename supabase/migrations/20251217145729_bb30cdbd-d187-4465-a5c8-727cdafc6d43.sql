-- FASE 1: PREPARAÇÃO E BACKUP
-- Criar tabela de backup com snapshot dos dados históricos

CREATE TABLE IF NOT EXISTS backup_migracao_endogastro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  tabela_origem TEXT NOT NULL,
  total_registros INTEGER NOT NULL,
  dados JSONB NOT NULL
);

-- Backup dos pacientes históricos
INSERT INTO backup_migracao_endogastro (tabela_origem, total_registros, dados)
SELECT 
  'endogastro_pacientes',
  COUNT(*),
  jsonb_agg(to_jsonb(ep.*))
FROM endogastro_pacientes ep;

-- Backup dos agendamentos históricos
INSERT INTO backup_migracao_endogastro (tabela_origem, total_registros, dados)
SELECT 
  'endogastro_agendamentos',
  COUNT(*),
  jsonb_agg(to_jsonb(ea.*))
FROM endogastro_agendamentos ea;

-- Backup dos bloqueios históricos
INSERT INTO backup_migracao_endogastro (tabela_origem, total_registros, dados)
SELECT 
  'endogastro_bloqueios_agenda',
  COUNT(*),
  jsonb_agg(to_jsonb(eb.*))
FROM endogastro_bloqueios_agenda eb;

-- Backup da fila espera histórica
INSERT INTO backup_migracao_endogastro (tabela_origem, total_registros, dados)
SELECT 
  'endogastro_fila_espera',
  COUNT(*),
  jsonb_agg(to_jsonb(ef.*))
FROM endogastro_fila_espera ef;

-- Backup dos médicos históricos
INSERT INTO backup_migracao_endogastro (tabela_origem, total_registros, dados)
SELECT 
  'endogastro_medicos',
  COUNT(*),
  jsonb_agg(to_jsonb(em.*))
FROM endogastro_medicos em;