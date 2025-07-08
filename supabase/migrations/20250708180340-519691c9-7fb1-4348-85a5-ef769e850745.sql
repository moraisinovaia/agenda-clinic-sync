-- Reabilitar RLS e criar políticas totalmente permissivas usando role anon
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

-- Criar políticas específicas para role anon (que é usado pelo cliente)
CREATE POLICY "Allow anon all access on agendamentos" ON public.agendamentos
TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon all access on pacientes" ON public.pacientes  
TO anon USING (true) WITH CHECK (true);

-- Também permitir para authenticated users
CREATE POLICY "Allow authenticated all access on agendamentos" ON public.agendamentos
TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated all access on pacientes" ON public.pacientes
TO authenticated USING (true) WITH CHECK (true);