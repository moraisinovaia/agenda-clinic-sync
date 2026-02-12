
CREATE POLICY "Users can read own clinic data"
ON public.clientes
FOR SELECT
TO authenticated
USING (id = get_user_cliente_id());
