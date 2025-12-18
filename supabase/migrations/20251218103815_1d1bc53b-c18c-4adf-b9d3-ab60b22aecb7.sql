-- ========================================
-- FASE 1: Limpeza do Banco de Dados
-- Remove dados obsoletos que não são usados pelo LLM API
-- ========================================

-- 1. Limpar tabela horarios_configuracao (não usada pelo LLM API)
TRUNCATE TABLE horarios_configuracao;

-- 2. Limpar campo medicos.horarios obsoleto
-- Este campo contém apenas metadados que já existem em business_rules
UPDATE medicos SET horarios = NULL;

-- 3. Garantir que trigger de sincronização está ativo
-- (já existe sync_medico_business_rules_trigger)

-- Verificação final
DO $$
DECLARE
  horarios_count INTEGER;
  medicos_horarios_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO horarios_count FROM horarios_configuracao;
  SELECT COUNT(*) INTO medicos_horarios_count FROM medicos WHERE horarios IS NOT NULL;
  
  RAISE NOTICE 'Limpeza concluída:';
  RAISE NOTICE '- horarios_configuracao: % registros', horarios_count;
  RAISE NOTICE '- medicos com horarios: % registros', medicos_horarios_count;
END $$;