-- Criar políticas RLS para a view vw_usuarios_pendentes
-- Permitir que usuários autenticados vejam usuários pendentes

-- Primeiro, verificar se RLS está habilitado na view
ALTER VIEW public.vw_usuarios_pendentes SET (security_barrier=true);

-- Criar política para permitir leitura por usuários autenticados
CREATE POLICY "usuarios_autenticados_podem_ver_pendentes" 
ON public.vw_usuarios_pendentes 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Criar política específica para admins verem todos os usuários pendentes
CREATE POLICY "admins_podem_ver_todos_pendentes" 
ON public.vw_usuarios_pendentes 
FOR SELECT 
USING (is_admin_user());

-- Verificar se as policies foram criadas
DO $$
BEGIN
  RAISE NOTICE 'Políticas RLS criadas para vw_usuarios_pendentes';
  RAISE NOTICE 'Usuários autenticados agora podem ver usuários pendentes de aprovação';
END $$;