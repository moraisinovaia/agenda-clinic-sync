-- Permitir que usuários vejam profiles de outros usuários da mesma clínica
CREATE POLICY "Usuarios podem ver profiles da mesma clinica"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  cliente_id = get_user_cliente_id() 
  AND status = 'aprovado'
);