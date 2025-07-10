-- Corrigir políticas RLS para bloqueios_agenda para permitir acesso via service role
DROP POLICY IF EXISTS "Acesso completo bloqueios_agenda" ON public.bloqueios_agenda;

-- Criar política que permite acesso completo para usuários autenticados e service role
CREATE POLICY "Acesso completo bloqueios_agenda" 
ON public.bloqueios_agenda 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Garantir que a tabela permite bypass de RLS para service role
ALTER TABLE public.bloqueios_agenda FORCE ROW LEVEL SECURITY;