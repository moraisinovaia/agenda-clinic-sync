-- MIGRATION: FIX INFINITE RECURSION IN PROFILES POLICIES
-- Remove ALL existing policies and create safe, non-recursive ones

-- 1. Primeiro, remover TODAS as políticas existentes da tabela profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_approved" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admins" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
DROP POLICY IF EXISTS "Users can view approved profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- 2. Criar função helper segura para verificar se é admin (sem recursão)
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() 
    AND p.role = 'admin' 
    AND p.status = 'aprovado'
  );
$$;

-- 3. Criar políticas simples e seguras
-- Política para o próprio usuário ver seus dados
CREATE POLICY "profiles_select_own" 
ON public.profiles 
FOR SELECT 
USING (user_id = auth.uid());

-- Política para usuários aprovados serem visíveis (exceto o próprio usuário)
CREATE POLICY "profiles_select_approved" 
ON public.profiles 
FOR SELECT 
USING (status = 'aprovado' AND user_id != auth.uid());

-- Política especial para admins verem usuários pendentes
CREATE POLICY "profiles_select_pending_by_admins" 
ON public.profiles 
FOR SELECT 
USING (
  status = 'pendente' 
  AND public.is_current_user_admin()
);

-- Política para inserir apenas próprio perfil
CREATE POLICY "profiles_insert_own" 
ON public.profiles 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Política para atualizar apenas próprio perfil
CREATE POLICY "profiles_update_own" 
ON public.profiles 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Política para deletar apenas próprio perfil
CREATE POLICY "profiles_delete_own" 
ON public.profiles 
FOR DELETE 
USING (user_id = auth.uid());

-- 4. Garantir que RLS está habilitado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Verificar e corrigir qualquer trigger que possa estar causando problemas
-- Recriar o trigger de atualização de updated_at se necessário
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar trigger na tabela profiles se não existir
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Log de conclusão
INSERT INTO public.system_logs (
  timestamp,
  level,
  message,
  context
) VALUES (
  now(),
  'info',
  'Fixed infinite recursion in profiles RLS policies',
  'MIGRATION'
);