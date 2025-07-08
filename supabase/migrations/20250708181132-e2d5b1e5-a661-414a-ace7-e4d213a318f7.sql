-- Remover todas as políticas existentes
DROP POLICY IF EXISTS "Public access to agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Public access to pacientes" ON public.pacientes;
DROP POLICY IF EXISTS "Allow anon all access on agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Allow anon all access on pacientes" ON public.pacientes;
DROP POLICY IF EXISTS "Allow authenticated all access on agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Allow authenticated all access on pacientes" ON public.pacientes;

-- Desabilitar RLS temporariamente para testes
ALTER TABLE public.agendamentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes DISABLE ROW LEVEL SECURITY;