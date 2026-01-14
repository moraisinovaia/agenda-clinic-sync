-- ============================================
-- REMOVER CONSTRAINT UNIQUE DE cliente_id
-- Permite múltiplas llm_clinic_config para mesmo cliente
-- (Ex: IPADO e Orion são filiais do mesmo cliente)
-- ============================================

-- Remover constraint unique de cliente_id
ALTER TABLE llm_clinic_config DROP CONSTRAINT IF EXISTS llm_clinic_config_cliente_id_key;