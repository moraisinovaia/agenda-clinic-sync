
-- Fix: Change RESTRICTIVE policies to PERMISSIVE for clientes table
-- Without at least one PERMISSIVE policy, all access is denied regardless of conditions

DROP POLICY IF EXISTS "Users can read own clinic data" ON clientes;
CREATE POLICY "Users can read own clinic data" ON clientes
  FOR SELECT
  USING (id = get_user_cliente_id());

DROP POLICY IF EXISTS "Approved users can view clientes" ON clientes;
CREATE POLICY "Approved users can view clientes" ON clientes
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.status::text = 'aprovado'::text
    )
  );
