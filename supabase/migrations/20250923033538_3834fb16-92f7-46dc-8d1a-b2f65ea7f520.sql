-- Adicionar política para admins poderem visualizar clientes
CREATE POLICY "Admins podem visualizar clientes" 
ON clientes 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND status = 'aprovado'
  )
);

-- Adicionar política para admins poderem gerenciar clientes
CREATE POLICY "Admins podem gerenciar clientes" 
ON clientes 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND status = 'aprovado'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND status = 'aprovado'
  )
);

-- Comentário sobre a política
COMMENT ON POLICY "Admins podem visualizar clientes" ON clientes IS 'Permite que administradores aprovados visualizem todos os clientes do sistema';
COMMENT ON POLICY "Admins podem gerenciar clientes" ON clientes IS 'Permite que administradores aprovados criem, atualizem e deletem clientes';