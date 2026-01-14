-- ============================================
-- PASSO 2: AJUSTAR CONSTRAINT UNIQUE PARA INCLUIR config_id
-- Permite mesmo médico em múltiplas configs (filiais)
-- ============================================

-- Remover constraint antiga
ALTER TABLE business_rules DROP CONSTRAINT IF EXISTS business_rules_unique;

-- Criar nova constraint que permite mesmo médico em configs diferentes
ALTER TABLE business_rules 
ADD CONSTRAINT business_rules_config_medico_unique 
UNIQUE (config_id, medico_id);