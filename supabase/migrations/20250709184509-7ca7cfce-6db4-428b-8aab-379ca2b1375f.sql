-- Corrigir políticas RLS para fila_espera com permissões mais amplas
DROP POLICY IF EXISTS "Permitir leitura geral fila_espera" ON public.fila_espera;
DROP POLICY IF EXISTS "Permitir inserção geral fila_espera" ON public.fila_espera;
DROP POLICY IF EXISTS "Permitir atualização geral fila_espera" ON public.fila_espera;
DROP POLICY IF EXISTS "Permitir exclusão geral fila_espera" ON public.fila_espera;

-- Criar políticas mais permissivas
CREATE POLICY "Acesso completo fila_espera" 
ON public.fila_espera 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Corrigir políticas RLS para preparos
DROP POLICY IF EXISTS "Permitir leitura geral" ON public.preparos;

CREATE POLICY "Acesso completo preparos" 
ON public.preparos 
FOR ALL 
USING (true)
WITH CHECK (true);