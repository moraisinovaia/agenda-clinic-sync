-- FASE 1 & 2: Sistema de Roles Seguro - Implementação Completa (CORRIGIDA)
-- AVISO: Esta migração vai modificar a estrutura de autenticação

-- 1. Criar enum para tipos de role
CREATE TYPE public.app_role AS ENUM ('admin', 'recepcionista', 'medico');

-- 2. Criar tabela isolada de roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

-- 3. Habilitar RLS na tabela user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Criar função SECURITY DEFINER para verificar roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = _role
  )
$$;

-- 5. Migrar dados existentes de profiles.role para user_roles
INSERT INTO public.user_roles (user_id, role, created_at)
SELECT 
  user_id, 
  role::app_role,
  created_at
FROM public.profiles
WHERE role IS NOT NULL 
  AND role IN ('admin', 'recepcionista', 'medico')
ON CONFLICT (user_id, role) DO NOTHING;

-- 6. Criar políticas RLS para user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Super admin can manage all roles"
ON public.user_roles FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND email = 'gabworais@gmail.com'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND email = 'gabworais@gmail.com'
  )
);

-- 7. Atualizar função is_admin_user() para usar has_role()
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

-- 8. Criar função is_super_admin() atualizada
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND email = 'gabworais@gmail.com'
  );
$$;

-- 9. REMOVER TODAS AS POLÍTICAS QUE DEPENDEM DE profiles.role
-- Audit logs
DROP POLICY IF EXISTS "Admins podem ver todos os audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admin access" ON public.audit_logs;

-- Profiles
DROP POLICY IF EXISTS "Admins podem gerenciar outros perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admin access" ON public.profiles;

-- Clientes
DROP POLICY IF EXISTS "Admins can manage clientes" ON public.clientes;

-- System logs
DROP POLICY IF EXISTS "Admins podem ver todos os logs" ON public.system_logs;

-- System settings
DROP POLICY IF EXISTS "Admins podem gerenciar configurações do sistema" ON public.system_settings;

-- 10. AGORA remover coluna role de profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role CASCADE;

-- 11. Criar novas políticas usando has_role()
-- Profiles
CREATE POLICY "Admins can manage all profiles"
ON public.profiles FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.is_super_admin() OR
  user_id = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.is_super_admin() OR
  user_id = auth.uid()
);

-- Clientes
CREATE POLICY "Admins can manage clientes"
ON public.clientes FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.is_super_admin()
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.is_super_admin()
);

-- Audit logs
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.is_super_admin()
);

-- System logs
CREATE POLICY "Admins can view all logs"
ON public.system_logs FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.is_super_admin() OR 
  user_id = auth.uid()
);

-- System settings
CREATE POLICY "Admins can manage settings"
ON public.system_settings FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.is_super_admin()
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.is_super_admin()
);

-- 12. Log da migração
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info',
  '[SECURITY] Sistema de roles seguro implementado com sucesso',
  'SECURE_ROLES_MIGRATION',
  jsonb_build_object(
    'migration_version', 'v2.0.0',
    'created_at', now(),
    'tables_created', jsonb_build_array('user_roles'),
    'functions_created', jsonb_build_array('has_role', 'is_admin_user', 'is_super_admin'),
    'policies_updated', 'all_tables',
    'profiles_role_column_removed', true
  )
);