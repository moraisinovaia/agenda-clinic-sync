-- Garantir permissões GRANT para service_role nas tabelas de backup
GRANT ALL ON public.system_backups TO service_role;
GRANT ALL ON public.system_settings TO service_role;

-- Garantir permissões para authenticated também
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_backups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;

-- Garantir permissões para anon (leitura apenas para debug)
GRANT SELECT ON public.system_backups TO anon;
GRANT SELECT ON public.system_settings TO anon;