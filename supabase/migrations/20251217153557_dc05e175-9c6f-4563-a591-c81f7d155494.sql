-- FASE 3: REMOVER TABELAS HISTÓRICAS (dados já migrados)
DROP TABLE IF EXISTS endogastro_agendamentos CASCADE;
DROP TABLE IF EXISTS endogastro_bloqueios_agenda CASCADE;
DROP TABLE IF EXISTS endogastro_fila_espera CASCADE;
DROP TABLE IF EXISTS endogastro_medicos CASCADE;
DROP TABLE IF EXISTS endogastro_pacientes CASCADE;
DROP TABLE IF EXISTS temp_medicos_backup CASCADE;

-- Remover tabelas temporárias de mapeamento
DROP TABLE IF EXISTS temp_medico_mapping CASCADE;
DROP TABLE IF EXISTS temp_atendimento_mapping CASCADE;

-- Manter tabela de backup da migração por segurança (30 dias)
-- DROP TABLE IF EXISTS backup_migracao_endogastro CASCADE; -- NÃO DELETAR AINDA