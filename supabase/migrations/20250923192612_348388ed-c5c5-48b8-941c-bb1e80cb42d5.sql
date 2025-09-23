-- Remover todas as tabelas IPADO (não utilizadas no sistema atual)
DROP TABLE IF EXISTS public.ipado_agendamentos CASCADE;
DROP TABLE IF EXISTS public.ipado_atendimentos CASCADE;
DROP TABLE IF EXISTS public.ipado_bloqueios_agenda CASCADE;
DROP TABLE IF EXISTS public.ipado_fila_espera CASCADE;
DROP TABLE IF EXISTS public.ipado_medicos CASCADE;
DROP TABLE IF EXISTS public.ipado_pacientes CASCADE;
DROP TABLE IF EXISTS public.ipado_preparos CASCADE;
DROP TABLE IF EXISTS public.ipado_profiles CASCADE;

-- Remover tabelas de auditoria não utilizadas
DROP TABLE IF EXISTS public.access_audit CASCADE;
DROP TABLE IF EXISTS public.super_admin_audit CASCADE;

-- Remover função relacionada se existir
DROP FUNCTION IF EXISTS public.sync_ipado_atendimentos_when_medico_changes() CASCADE;

-- Log da limpeza
INSERT INTO public.system_logs (
  timestamp, level, message, context
) VALUES (
  now(), 'info', 
  'Limpeza do banco: removidas 10 tabelas desnecessárias', 
  'DATABASE_CLEANUP'
);