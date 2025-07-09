-- Corrigir políticas RLS para fila_espera
DROP POLICY IF EXISTS "Public access to fila_espera" ON public.fila_espera;

-- Criar políticas corretas para fila_espera
CREATE POLICY "Permitir leitura geral fila_espera" 
ON public.fila_espera 
FOR SELECT 
USING (true);

CREATE POLICY "Permitir inserção geral fila_espera" 
ON public.fila_espera 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Permitir atualização geral fila_espera" 
ON public.fila_espera 
FOR UPDATE 
USING (true)
WITH CHECK (true);

CREATE POLICY "Permitir exclusão geral fila_espera" 
ON public.fila_espera 
FOR DELETE 
USING (true);

-- Corrigir políticas RLS para fila_notificacoes
DROP POLICY IF EXISTS "Public access to fila_notificacoes" ON public.fila_notificacoes;

CREATE POLICY "Permitir leitura geral fila_notificacoes" 
ON public.fila_notificacoes 
FOR SELECT 
USING (true);

CREATE POLICY "Permitir inserção geral fila_notificacoes" 
ON public.fila_notificacoes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Permitir atualização geral fila_notificacoes" 
ON public.fila_notificacoes 
FOR UPDATE 
USING (true)
WITH CHECK (true);

CREATE POLICY "Permitir exclusão geral fila_notificacoes" 
ON public.fila_notificacoes 
FOR DELETE 
USING (true);