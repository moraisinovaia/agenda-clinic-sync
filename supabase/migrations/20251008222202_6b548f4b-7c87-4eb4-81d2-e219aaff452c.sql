-- ============================================
-- CORREÇÃO DEFINITIVA: Políticas RLS de horarios_vazios
-- ============================================
-- Problema: get_user_cliente_id() pode retornar NULL temporariamente
-- Solução: Políticas mais robustas que lidam com NULL e permitem acesso apropriado

-- 1. Remover TODAS as políticas existentes
DROP POLICY IF EXISTS "Super admin pode gerenciar todos horários vazios" ON public.horarios_vazios;
DROP POLICY IF EXISTS "Usuários visualizam horários vazios da sua clínica" ON public.horarios_vazios;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir horários vazios" ON public.horarios_vazios;
DROP POLICY IF EXISTS "Usuários atualizam horários da sua clínica" ON public.horarios_vazios;
DROP POLICY IF EXISTS "Usuários podem atualizar horários vazios da sua clínica" ON public.horarios_vazios;
DROP POLICY IF EXISTS "Usuários deletam horários da sua clínica" ON public.horarios_vazios;

-- 2. Criar políticas SELECT mais robustas
CREATE POLICY "SELECT: Usuários visualizam horários da sua clínica"
ON public.horarios_vazios
FOR SELECT
TO authenticated
USING (
  -- Permitir se é super admin
  is_super_admin()
  OR
  -- Permitir se o cliente_id do registro corresponde ao cliente_id do usuário
  -- E lidar graciosamente com NULL
  (
    get_user_cliente_id() IS NOT NULL 
    AND cliente_id = get_user_cliente_id()
  )
  OR
  -- Fallback: permitir se usuário está autenticado e cliente_id corresponde
  -- ao cliente_id do profile do usuário (consulta direta)
  (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
      AND p.cliente_id = horarios_vazios.cliente_id
      AND p.status = 'aprovado'
    )
  )
);

-- 3. Criar política INSERT robusta
CREATE POLICY "INSERT: Usuários autenticados podem inserir horários"
ON public.horarios_vazios
FOR INSERT
TO authenticated
WITH CHECK (
  -- Permitir se é super admin
  is_super_admin()
  OR
  -- Permitir se usuário está autenticado
  auth.uid() IS NOT NULL
);

-- 4. Criar política UPDATE robusta
CREATE POLICY "UPDATE: Usuários atualizam horários da sua clínica"
ON public.horarios_vazios
FOR UPDATE
TO authenticated
USING (
  is_super_admin()
  OR
  (
    auth.uid() IS NOT NULL 
    AND get_user_cliente_id() IS NOT NULL
    AND cliente_id = get_user_cliente_id()
  )
  OR
  (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
      AND p.cliente_id = horarios_vazios.cliente_id
      AND p.status = 'aprovado'
    )
  )
)
WITH CHECK (
  is_super_admin()
  OR
  (
    auth.uid() IS NOT NULL 
    AND get_user_cliente_id() IS NOT NULL
    AND cliente_id = get_user_cliente_id()
  )
  OR
  (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
      AND p.cliente_id = horarios_vazios.cliente_id
      AND p.status = 'aprovado'
    )
  )
);

-- 5. Criar política DELETE robusta
CREATE POLICY "DELETE: Usuários deletam horários da sua clínica"
ON public.horarios_vazios
FOR DELETE
TO authenticated
USING (
  is_super_admin()
  OR
  (
    auth.uid() IS NOT NULL 
    AND get_user_cliente_id() IS NOT NULL
    AND cliente_id = get_user_cliente_id()
  )
  OR
  (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
      AND p.cliente_id = horarios_vazios.cliente_id
      AND p.status = 'aprovado'
    )
  )
);

-- 6. Comentários para documentação
COMMENT ON POLICY "SELECT: Usuários visualizam horários da sua clínica" ON public.horarios_vazios IS 
'Política robusta que permite SELECT com múltiplos caminhos: super admin, get_user_cliente_id(), ou verificação direta no profiles';

COMMENT ON POLICY "INSERT: Usuários autenticados podem inserir horários" ON public.horarios_vazios IS 
'Política permissiva para INSERT - valida cliente_id na aplicação';

COMMENT ON POLICY "UPDATE: Usuários atualizam horários da sua clínica" ON public.horarios_vazios IS 
'Política robusta para UPDATE com múltiplos caminhos de validação';

COMMENT ON POLICY "DELETE: Usuários deletam horários da sua clínica" ON public.horarios_vazios IS 
'Política robusta para DELETE com múltiplos caminhos de validação';