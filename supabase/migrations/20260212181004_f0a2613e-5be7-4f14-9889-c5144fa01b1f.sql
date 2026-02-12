
-- Remover politica restrictive existente
DROP POLICY IF EXISTS "Users can read own clinic data" ON public.clientes;

-- Recriar como PERMISSIVE (default)
CREATE POLICY "Users can read own clinic data"
ON public.clientes
FOR SELECT
TO authenticated
USING (id = get_user_cliente_id());
