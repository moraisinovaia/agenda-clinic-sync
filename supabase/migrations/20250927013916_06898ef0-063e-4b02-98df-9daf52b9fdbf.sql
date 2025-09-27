-- FASE 2: CORREÇÃO DAS 4 FUNÇÕES FINAIS
-- Corrigir search_path das 4 funções restantes que causam warnings de segurança
ALTER FUNCTION public.is_current_user_admin() SET search_path TO 'public';
ALTER FUNCTION public.notify_n8n_appointment() SET search_path TO 'public';
ALTER FUNCTION public.notify_n8n_appointment_created() SET search_path TO 'public';
ALTER FUNCTION public.update_updated_at_column() SET search_path TO 'public';

-- Log da correção
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info', 
  'FASE 2: Corrigidas 4 funções de segurança críticas',
  'SECURITY_FUNCTIONS_FIXED',
  jsonb_build_object(
    'functions_corrected', ARRAY['is_current_user_admin', 'notify_n8n_appointment', 'notify_n8n_appointment_created', 'update_updated_at_column'],
    'security_impact', 'CRITICAL - Search path vulnerabilities eliminadas'
  )
);