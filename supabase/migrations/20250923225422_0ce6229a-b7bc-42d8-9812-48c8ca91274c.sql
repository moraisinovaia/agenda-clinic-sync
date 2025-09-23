-- Corrigir funções duplicadas e políticas RLS (com CASCADE)

-- 1. Remover políticas que dependem da função duplicada
DROP POLICY IF EXISTS "profiles_admin_pending" ON public.profiles;

-- 2. Remover a função is_admin_safe duplicada com CASCADE
DROP FUNCTION IF EXISTS public.is_admin_safe(uuid) CASCADE;

-- 3. Garantir que temos apenas a função correta
CREATE OR REPLACE FUNCTION public.is_admin_safe()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND status = 'aprovado'
  );
$$;

-- 4. Recriar política para admins verem usuários pendentes
CREATE POLICY "profiles_admin_pending"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  status = 'pendente' AND public.is_admin_safe()
);

-- 5. Verificar se a política de usuários aprovados existe e recriar se necessário
DROP POLICY IF EXISTS "profiles_approved_visible" ON public.profiles;
CREATE POLICY "profiles_approved_visible"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  status = 'aprovado' AND user_id != auth.uid()
);

-- 6. Log da correção
INSERT INTO public.system_logs (
  timestamp, level, message, context
) VALUES (
  now(), 'info', 
  'Corrigidas funções duplicadas e políticas RLS para aprovação de usuários',
  'USER_APPROVAL_FIX'
);