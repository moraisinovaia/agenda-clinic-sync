-- FASE 1: Remoção de Tabelas Específicas e Duplicadas
-- Remover triggers e funções relacionadas primeiro

-- Remover trigger de métricas diárias se existir
DROP TRIGGER IF EXISTS trigger_atualizar_metricas_diarias ON logs_auditoria_medica;

-- Remover função relacionada
DROP FUNCTION IF EXISTS public.atualizar_metricas_diarias();

-- Remover função de relatório de auditoria
DROP FUNCTION IF EXISTS public.relatorio_auditoria_periodo(date, date);

-- Remover views relacionadas se existirem
DROP VIEW IF EXISTS public.vw_alertas_ativos;
DROP VIEW IF EXISTS public.vw_dashboard_executivo;

-- FASE 1.1: Remover tabelas médicas específicas
DROP TABLE IF EXISTS public.alimentos_teste_hidrogenio CASCADE;
DROP TABLE IF EXISTS public.questionario_pre_colonoscopia CASCADE;

-- FASE 1.2: Remover sistema de auditoria médica completo
DROP TABLE IF EXISTS public.validacoes_detalhadas CASCADE;
DROP TABLE IF EXISTS public.alertas_criticos CASCADE;
DROP TABLE IF EXISTS public.metricas_diarias CASCADE;
DROP TABLE IF EXISTS public.logs_auditoria_medica CASCADE;
DROP TABLE IF EXISTS public.config_sistema_auditoria CASCADE;

-- FASE 1.3: Remover tabelas duplicadas/redundantes
DROP TABLE IF EXISTS public.clinica_valores CASCADE;
DROP TABLE IF EXISTS public.configuracoes_clinica CASCADE;
DROP TABLE IF EXISTS public.n8n_chat_histories CASCADE;

-- Remover funções relacionadas ao sistema de auditoria
DROP FUNCTION IF EXISTS public.dashboard_tempo_real();
DROP FUNCTION IF EXISTS public.is_admin_auditoria();
DROP FUNCTION IF EXISTS public.is_authenticated_user();

-- Log da limpeza
INSERT INTO public.system_logs (
    timestamp,
    level,
    message,
    context
) VALUES (
    now(),
    'info',
    'FASE 1 - Limpeza de banco: Removidas 9 tabelas específicas e duplicadas',
    'DATABASE_CLEANUP_PHASE_1'
);