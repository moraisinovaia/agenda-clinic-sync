-- Ajustar políticas RLS para permitir que usuários aprovados vejam clientes
-- para poder selecionar na aprovação

-- Remover política restritiva atual
DROP POLICY IF EXISTS "Admins podem visualizar clientes" ON public.clientes;

-- Criar nova política que permite usuários aprovados verem clientes
CREATE POLICY "Usuarios aprovados podem visualizar clientes" 
ON public.clientes 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND status = 'aprovado'
  )
);

-- Manter as outras políticas apenas para admins
-- Mas permitir que usuários aprovados vejam para seleção