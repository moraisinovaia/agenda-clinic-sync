-- Restaurar policy para service_role acessar profiles
-- Foi removida na migration 20250710030034 e nunca recriada
-- Necessária para Edge Functions administrativas (user-management, etc)

CREATE POLICY "Service role can manage profiles"
ON public.profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Log da restauração
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info',
  '[SECURITY] Policy service_role restaurada para tabela profiles',
  'DATABASE_MIGRATION',
  jsonb_build_object(
    'table', 'profiles',
    'policy', 'Service role can manage profiles',
    'reason', 'Restaurar acesso de Edge Functions administrativas',
    'removed_in', '20250710030034'
  )
);