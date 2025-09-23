-- Fase 2A: Remoção das 4 tabelas seguras sem impacto
-- Remover tabelas vazias de auditoria e logs

DROP TABLE IF EXISTS public.access_audit CASCADE;
DROP TABLE IF EXISTS public.agendamentos_audit CASCADE; 
DROP TABLE IF EXISTS public.client_audit_logs CASCADE;
DROP TABLE IF EXISTS public.system_health CASCADE;

-- Log da operação para auditoria
INSERT INTO public.system_logs (
  timestamp, level, message, context
) VALUES (
  now(), 'info', 
  'Fase 2A: Removidas 4 tabelas de auditoria/logs vazias (access_audit, agendamentos_audit, client_audit_logs, system_health)', 
  'DATABASE_CLEANUP_PHASE_2A'
);