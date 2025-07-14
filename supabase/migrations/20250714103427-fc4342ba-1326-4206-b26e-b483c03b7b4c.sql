-- Criar políticas RLS para configuracoes_clinica
CREATE POLICY "Usuários autenticados podem inserir configurações" 
ON public.configuracoes_clinica 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem atualizar configurações" 
ON public.configuracoes_clinica 
FOR UPDATE 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem deletar configurações" 
ON public.configuracoes_clinica 
FOR DELETE 
USING (auth.uid() IS NOT NULL);