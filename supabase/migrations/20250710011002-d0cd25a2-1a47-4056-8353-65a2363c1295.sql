-- Verificar políticas atuais e corrigir problemas de RLS
-- Primeiro, verificar se a tabela possui RLS habilitado
SELECT schemaname, tablename, rowsecurity, forcerowsecurity FROM pg_tables WHERE tablename = 'bloqueios_agenda';

-- Verificar políticas existentes
SELECT policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'bloqueios_agenda';

-- Dropar todas as políticas existentes e recriar uma política simples
DROP POLICY IF EXISTS "Acesso completo bloqueios_agenda" ON public.bloqueios_agenda;

-- Desabilitar temporariamente RLS para testes
ALTER TABLE public.bloqueios_agenda DISABLE ROW LEVEL SECURITY;

-- Reabilitar RLS com política que permite acesso via service role
ALTER TABLE public.bloqueios_agenda ENABLE ROW LEVEL SECURITY;

-- Criar política que funciona tanto para usuários quanto para service role
CREATE POLICY "bloqueios_agenda_policy" 
ON public.bloqueios_agenda 
FOR ALL 
TO public, service_role
USING (true) 
WITH CHECK (true);