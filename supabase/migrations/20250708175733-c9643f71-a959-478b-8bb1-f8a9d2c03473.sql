-- Desabilitar RLS temporariamente para permitir agendamentos
ALTER TABLE public.agendamentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes DISABLE ROW LEVEL SECURITY;