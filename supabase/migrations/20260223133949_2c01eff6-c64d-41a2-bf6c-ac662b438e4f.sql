-- 1. Alterar default da coluna para NULL
ALTER TABLE llm_clinic_config ALTER COLUMN data_minima_agendamento SET DEFAULT NULL;

-- 2. Setar data_minima_agendamento para NULL em TODAS as clínicas
UPDATE llm_clinic_config SET data_minima_agendamento = NULL;