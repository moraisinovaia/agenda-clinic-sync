-- Adicionar políticas de INSERT, UPDATE, DELETE para medicos e atendimentos se necessário
-- Para medicos
CREATE POLICY IF NOT EXISTS "Public access to medicos" ON public.medicos
FOR ALL USING (true) WITH CHECK (true);

-- Para atendimentos  
CREATE POLICY IF NOT EXISTS "Public access to atendimentos" ON public.atendimentos
FOR ALL USING (true) WITH CHECK (true);