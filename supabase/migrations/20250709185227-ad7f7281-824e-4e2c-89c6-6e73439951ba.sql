-- Garantir permissões completas para o role anon nas tabelas
GRANT ALL PRIVILEGES ON TABLE public.fila_espera TO anon;
GRANT ALL PRIVILEGES ON TABLE public.fila_notificacoes TO anon;
GRANT ALL PRIVILEGES ON TABLE public.preparos TO anon;
GRANT ALL PRIVILEGES ON TABLE public.pacientes TO anon;
GRANT ALL PRIVILEGES ON TABLE public.medicos TO anon;
GRANT ALL PRIVILEGES ON TABLE public.atendimentos TO anon;
GRANT ALL PRIVILEGES ON TABLE public.agendamentos TO anon;

-- Garantir permissões para authenticated também
GRANT ALL PRIVILEGES ON TABLE public.fila_espera TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.fila_notificacoes TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.preparos TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.pacientes TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.medicos TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.atendimentos TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.agendamentos TO authenticated;

-- Garantir permissões para public role
GRANT ALL PRIVILEGES ON TABLE public.fila_espera TO public;
GRANT ALL PRIVILEGES ON TABLE public.fila_notificacoes TO public;
GRANT ALL PRIVILEGES ON TABLE public.preparos TO public;
GRANT ALL PRIVILEGES ON TABLE public.pacientes TO public;
GRANT ALL PRIVILEGES ON TABLE public.medicos TO public;
GRANT ALL PRIVILEGES ON TABLE public.atendimentos TO public;
GRANT ALL PRIVILEGES ON TABLE public.agendamentos TO public;