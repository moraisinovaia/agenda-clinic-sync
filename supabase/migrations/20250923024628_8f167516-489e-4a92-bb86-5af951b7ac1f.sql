-- FASE 1: Remoção de Tabelas Específicas e Duplicadas
-- Remover na ordem correta das dependências

-- Primeiro, remover todas as tabelas com CASCADE para remover dependências automaticamente
DROP TABLE IF EXISTS public.alimentos_teste_hidrogenio CASCADE;
DROP TABLE IF EXISTS public.questionario_pre_colonoscopia CASCADE;
DROP TABLE IF EXISTS public.validacoes_detalhadas CASCADE;
DROP TABLE IF EXISTS public.alertas_criticos CASCADE;
DROP TABLE IF EXISTS public.metricas_diarias CASCADE;
DROP TABLE IF EXISTS public.logs_auditoria_medica CASCADE;
DROP TABLE IF EXISTS public.config_sistema_auditoria CASCADE;
DROP TABLE IF EXISTS public.clinica_valores CASCADE;
DROP TABLE IF EXISTS public.configuracoes_clinica CASCADE;
DROP TABLE IF EXISTS public.n8n_chat_histories CASCADE;

-- Depois remover funções órfãs (se ainda existirem)
DROP FUNCTION IF EXISTS public.atualizar_metricas_diarias() CASCADE;
DROP FUNCTION IF EXISTS public.relatorio_auditoria_periodo(date, date) CASCADE;
DROP FUNCTION IF EXISTS public.dashboard_tempo_real() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_auditoria() CASCADE;
DROP FUNCTION IF EXISTS public.is_authenticated_user() CASCADE;

-- Remover views órfãs (se ainda existirem)
DROP VIEW IF EXISTS public.vw_alertas_ativos CASCADE;
DROP VIEW IF EXISTS public.vw_dashboard_executivo CASCADE;

-- Log da limpeza
INSERT INTO public.system_logs (
    timestamp,
    level,
    message,
    context
) VALUES (
    now(),
    'info',
    'FASE 1 - Limpeza de banco: Removidas 9 tabelas específicas e duplicadas com dependências',
    'DATABASE_CLEANUP_PHASE_1'
);