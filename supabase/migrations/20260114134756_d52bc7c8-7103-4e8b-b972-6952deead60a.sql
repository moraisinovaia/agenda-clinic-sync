-- ============================================
-- PASSO 1: ADICIONAR config_id EM business_rules E llm_mensagens
-- ============================================

-- Adicionar config_id em business_rules
ALTER TABLE business_rules 
ADD COLUMN IF NOT EXISTS config_id UUID REFERENCES llm_clinic_config(id);

-- Adicionar config_id em llm_mensagens
ALTER TABLE llm_mensagens 
ADD COLUMN IF NOT EXISTS config_id UUID REFERENCES llm_clinic_config(id);

-- Migrar dados existentes: associar business_rules ao config correspondente
UPDATE business_rules br
SET config_id = lcc.id
FROM llm_clinic_config lcc
WHERE br.cliente_id = lcc.cliente_id
  AND br.config_id IS NULL;

-- Migrar dados existentes: associar llm_mensagens ao config correspondente  
UPDATE llm_mensagens lm
SET config_id = lcc.id
FROM llm_clinic_config lcc
WHERE lm.cliente_id = lcc.cliente_id
  AND lm.config_id IS NULL;