
-- Corrigir parceiro da Clinica Orion para INOVAIA
UPDATE clientes 
SET parceiro = 'INOVAIA', updated_at = now()
WHERE nome = 'Clínica Orion';

-- Corrigir RLS da partner_branding (politicas restritivas -> permissivas)
DROP POLICY IF EXISTS "Anyone can read partner branding" ON public.partner_branding;
DROP POLICY IF EXISTS "Super admin can manage partner branding" ON public.partner_branding;

CREATE POLICY "Anyone can read partner branding"
  ON public.partner_branding
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Super admin can manage partner branding"
  ON public.partner_branding
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
