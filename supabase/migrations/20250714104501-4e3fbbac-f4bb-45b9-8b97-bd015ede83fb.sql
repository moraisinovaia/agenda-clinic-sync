-- Habilitar realtime para tabela agendamentos
ALTER TABLE public.agendamentos REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agendamentos;