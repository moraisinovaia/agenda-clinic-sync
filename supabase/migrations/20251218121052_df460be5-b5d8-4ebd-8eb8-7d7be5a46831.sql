-- Desabilitar triggers de validação para migração
ALTER TABLE agendamentos DISABLE TRIGGER validate_insurance_trigger;
ALTER TABLE agendamentos DISABLE TRIGGER validate_patient_age_trigger;
ALTER TABLE agendamentos DISABLE TRIGGER validate_appointment_date_trigger;

-- Migrar agendamentos de Consulta para Consulta Endocrinológica (apenas da Dra. Adriana)
UPDATE agendamentos 
SET atendimento_id = '6b2f01e9-4624-42a6-ab0a-557da9654227'
WHERE atendimento_id = '84d3a1e8-405b-4218-a891-e9fa25e3fa41'
AND medico_id = '32d30887-b876-4502-bf04-e55d7fb55b50'
AND cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';

-- Migrar agendamentos de Retorno para Retorno Endocrinológico (apenas da Dra. Adriana)
UPDATE agendamentos 
SET atendimento_id = '96010447-7869-4299-b0d0-b9fa91e6cea7'
WHERE atendimento_id = '4a34ba94-d5a1-4d0f-befc-a4d24abc6536'
AND medico_id = '32d30887-b876-4502-bf04-e55d7fb55b50'
AND cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';

-- Reabilitar triggers
ALTER TABLE agendamentos ENABLE TRIGGER validate_insurance_trigger;
ALTER TABLE agendamentos ENABLE TRIGGER validate_patient_age_trigger;
ALTER TABLE agendamentos ENABLE TRIGGER validate_appointment_date_trigger;