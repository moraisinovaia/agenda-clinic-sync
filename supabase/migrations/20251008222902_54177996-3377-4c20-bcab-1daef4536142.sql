-- ============================================
-- CORREÇÃO DEFINITIVA v2: Políticas RLS simplificadas para horarios_vazios
-- ============================================
-- Problema: Políticas complexas com múltiplas condições OR não estão sendo avaliadas corretamente
-- Solução: Políticas mais simples e diretas que evitam funções quando possível

-- 1. Remover todas as políticas existentes
DROP POLICY IF EXISTS "SELECT: Usuários visualizam horários da sua clínica" ON public.horarios_vazios;
DROP POLICY IF EXISTS "INSERT: Usuários autenticados podem inserir horários" ON public.horarios_vazios;
DROP POLICY IF EXISTS "UPDATE: Usuários atualizam horários da sua clínica" ON public.horarios_vazios;
DROP POLICY IF EXISTS "DELETE: Usuários deletam horários da sua clínica" ON public.horarios_vazios;

-- 2. Criar política SELECT simplificada - foca no EXISTS direto
CREATE POLICY "horarios_vazios_select_policy"
ON public.horarios_vazios
FOR SELECT
TO authenticated
USING (
  -- Verifica se o cliente_id do horário corresponde ao cliente_id do perfil do usuário
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.user_id = auth.uid()
      AND profiles.cliente_id = horarios_vazios.cliente_id
      AND profiles.status = 'aprovado'
  )
);

-- 3. Criar política SELECT para super admin (política separada)
CREATE POLICY "horarios_vazios_select_super_admin"
ON public.horarios_vazios
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE users.id = auth.uid() 
    AND users.email = 'gabworais@gmail.com'
  )
);

-- 4. Política INSERT simplificada
CREATE POLICY "horarios_vazios_insert_policy"
ON public.horarios_vazios
FOR INSERT
TO authenticated
WITH CHECK (
  -- Verifica que o horário está sendo inserido para o cliente correto do usuário
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.user_id = auth.uid()
      AND profiles.cliente_id = horarios_vazios.cliente_id
      AND profiles.status = 'aprovado'
  )
);

-- 5. Política INSERT para super admin
CREATE POLICY "horarios_vazios_insert_super_admin"
ON public.horarios_vazios
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE users.id = auth.uid() 
    AND users.email = 'gabworais@gmail.com'
  )
);

-- 6. Política UPDATE simplificada
CREATE POLICY "horarios_vazios_update_policy"
ON public.horarios_vazios
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.user_id = auth.uid()
      AND profiles.cliente_id = horarios_vazios.cliente_id
      AND profiles.status = 'aprovado'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.user_id = auth.uid()
      AND profiles.cliente_id = horarios_vazios.cliente_id
      AND profiles.status = 'aprovado'
  )
);

-- 7. Política UPDATE para super admin
CREATE POLICY "horarios_vazios_update_super_admin"
ON public.horarios_vazios
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE users.id = auth.uid() 
    AND users.email = 'gabworais@gmail.com'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE users.id = auth.uid() 
    AND users.email = 'gabworais@gmail.com'
  )
);

-- 8. Política DELETE simplificada
CREATE POLICY "horarios_vazios_delete_policy"
ON public.horarios_vazios
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.user_id = auth.uid()
      AND profiles.cliente_id = horarios_vazios.cliente_id
      AND profiles.status = 'aprovado'
  )
);

-- 9. Política DELETE para super admin
CREATE POLICY "horarios_vazios_delete_super_admin"
ON public.horarios_vazios
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE users.id = auth.uid() 
    AND users.email = 'gabworais@gmail.com'
  )
);

-- 10. Adicionar índices para otimizar as políticas RLS
CREATE INDEX IF NOT EXISTS idx_horarios_vazios_cliente_id ON public.horarios_vazios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_horarios_vazios_status ON public.horarios_vazios(status);
CREATE INDEX IF NOT EXISTS idx_horarios_vazios_data ON public.horarios_vazios(data);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id_cliente_id ON public.profiles(user_id, cliente_id);