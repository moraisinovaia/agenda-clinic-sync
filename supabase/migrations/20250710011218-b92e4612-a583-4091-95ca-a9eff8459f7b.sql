-- Conceder permissões explícitas para todos os papéis necessários
GRANT ALL ON public.bloqueios_agenda TO postgres;
GRANT ALL ON public.bloqueios_agenda TO anon;
GRANT ALL ON public.bloqueios_agenda TO authenticated;
GRANT ALL ON public.bloqueios_agenda TO service_role;

-- Verificar se a tabela foi criada corretamente
SELECT table_name, table_schema FROM information_schema.tables WHERE table_name = 'bloqueios_agenda';

-- Verificar permissões da tabela
SELECT grantee, privilege_type FROM information_schema.role_table_grants 
WHERE table_name = 'bloqueios_agenda' AND table_schema = 'public';