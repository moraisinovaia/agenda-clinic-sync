-- Fase 2B: Limpeza Final de Views e Tabelas Desnecessárias

-- Remover views desnecessárias
DROP VIEW IF EXISTS public.vw_usuarios_pendentes;
DROP VIEW IF EXISTS public.vw_exames_combinaveis;

-- Remover tabelas vazias/não utilizadas
DROP TABLE IF EXISTS public.system_backups;
DROP TABLE IF EXISTS public.client_usage_metrics;

-- Log da operação
INSERT INTO public.system_logs (
  timestamp,
  level,
  message,
  context
) VALUES (
  now(),
  'info',
  'Fase 2B concluída - Removidas 2 views e 2 tabelas desnecessárias',
  'DATABASE_CLEANUP_PHASE_2B'
);