-- Reabilitar RLS e criar políticas permissivas para acesso público
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

-- Criar políticas permissivas para agendamentos (acesso total público)
CREATE POLICY "Public access to agendamentos" ON public.agendamentos
FOR ALL USING (true) WITH CHECK (true);

-- Criar políticas permissivas para pacientes (acesso total público)  
CREATE POLICY "Public access to pacientes" ON public.pacientes
FOR ALL USING (true) WITH CHECK (true);

-- Garantir que as tabelas relacionadas também tenham acesso público
-- Verificar se medicos e atendimentos já têm políticas adequadas