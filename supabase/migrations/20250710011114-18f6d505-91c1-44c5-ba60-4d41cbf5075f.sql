-- Reabilitar RLS e criar política mais permissiva
ALTER TABLE public.bloqueios_agenda ENABLE ROW LEVEL SECURITY;

-- Dropar qualquer política existente
DROP POLICY IF EXISTS "bloqueios_agenda_policy" ON public.bloqueios_agenda;
DROP POLICY IF EXISTS "Acesso completo bloqueios_agenda" ON public.bloqueios_agenda;

-- Criar política universal que permite tudo
CREATE POLICY "allow_all_bloqueios" 
ON public.bloqueios_agenda 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Garantir que a função de trigger existe
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;