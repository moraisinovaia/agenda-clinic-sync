-- Fix RLS policies for clientes table to allow approved users to access clients

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins podem inserir clientes" ON public.clientes;
DROP POLICY IF EXISTS "Admins podem atualizar clientes" ON public.clientes;
DROP POLICY IF EXISTS "Admins podem deletar clientes" ON public.clientes;
DROP POLICY IF EXISTS "Usuarios aprovados podem visualizar clientes" ON public.clientes;

-- Create new simplified policies that work correctly
CREATE POLICY "Approved users can view clientes"
ON public.clientes FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.status = 'aprovado'
  )
);

CREATE POLICY "Admins can manage clientes"
ON public.clientes FOR ALL
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
    AND profiles.status = 'aprovado'
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
    AND profiles.status = 'aprovado'
  )
);