
ALTER TABLE public.parceiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view parceiros"
ON public.parceiros
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Super admin can manage parceiros"
ON public.parceiros
FOR ALL
TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());
