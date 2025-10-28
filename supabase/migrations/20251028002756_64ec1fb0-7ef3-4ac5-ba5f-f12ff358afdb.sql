-- Remove a política problemática que causa ciclo circular
DROP POLICY IF EXISTS "Usuarios podem ver profiles da mesma clinica" ON public.profiles;

-- 1. Política para permitir que usuário veja seu próprio profile
-- Isso quebra o ciclo circular e permite que get_user_cliente_id() funcione
CREATE POLICY "Ver proprio profile" 
ON public.profiles
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- 2. Política para ver profiles aprovados de outros usuários da mesma clínica
-- Usa EXISTS com subquery direta para evitar dependência circular
CREATE POLICY "Ver profiles aprovados mesma clinica" 
ON public.profiles
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles my_profile
    WHERE my_profile.user_id = auth.uid()
    AND my_profile.cliente_id = profiles.cliente_id
  )
  AND status = 'aprovado'
  AND user_id != auth.uid()
);