-- Conceder permissões explícitas para anon
GRANT ALL ON public.pacientes TO anon;
GRANT ALL ON public.agendamentos TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;