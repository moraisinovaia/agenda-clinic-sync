-- Remover políticas existentes e criar novas políticas permissivas
DROP POLICY IF EXISTS "Allow public read for active medicos" ON public.medicos;
DROP POLICY IF EXISTS "Permitir leitura geral" ON public.atendimentos;

-- Criar políticas de acesso total para medicos
CREATE POLICY "Public access to medicos" ON public.medicos
FOR ALL USING (true) WITH CHECK (true);

-- Criar políticas de acesso total para atendimentos  
CREATE POLICY "Public access to atendimentos" ON public.atendimentos
FOR ALL USING (true) WITH CHECK (true);