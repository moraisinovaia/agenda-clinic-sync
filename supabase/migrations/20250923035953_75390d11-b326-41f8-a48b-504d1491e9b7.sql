-- Remover policy que depende da função is_admin_safe
DROP POLICY IF EXISTS "profiles_admin_pending" ON public.profiles;

-- Remover função existente
DROP FUNCTION IF EXISTS public.is_admin_safe(uuid);

-- Criar função SECURITY DEFINER segura para verificar se é admin
CREATE OR REPLACE FUNCTION public.is_admin_safe(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE user_id = check_user_id 
    AND role = 'admin' 
    AND status = 'aprovado'
  );
$$;

-- Recriar policy do profiles que foi removida
CREATE POLICY "profiles_admin_pending" 
ON public.profiles 
FOR SELECT 
USING (status = 'pendente' AND public.is_admin_safe());

-- Remover policies antigas da tabela clientes
DROP POLICY IF EXISTS "Admins podem gerenciar clientes" ON public.clientes;
DROP POLICY IF EXISTS "Admins podem visualizar clientes" ON public.clientes;  
DROP POLICY IF EXISTS "Super admins podem gerenciar clientes" ON public.clientes;

-- Criar policies simplificadas usando a função segura
CREATE POLICY "Admins podem visualizar clientes" 
ON public.clientes 
FOR SELECT 
USING (public.is_admin_safe());

CREATE POLICY "Admins podem inserir clientes" 
ON public.clientes 
FOR INSERT 
WITH CHECK (public.is_admin_safe());

CREATE POLICY "Admins podem atualizar clientes" 
ON public.clientes 
FOR UPDATE 
USING (public.is_admin_safe());

CREATE POLICY "Admins podem deletar clientes" 
ON public.clientes 
FOR DELETE 
USING (public.is_admin_safe());