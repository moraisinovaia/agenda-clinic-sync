-- MIGRATION: FINAL FIX FOR PROFILES RLS - COMPREHENSIVE SOLUTION
-- Ensure no infinite recursion and create bulletproof policies

-- 1. Drop ALL policies on profiles table completely
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_approved" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_pending_by_admins" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;

-- 2. Temporarily disable RLS to ensure clean slate
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 3. Create ultra-safe function that bypasses any potential recursion
CREATE OR REPLACE FUNCTION public.get_user_role_safe(p_user_id UUID)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE user_id = p_user_id LIMIT 1),
    'none'
  );
$$;

-- 4. Create function to check admin status safely
CREATE OR REPLACE FUNCTION public.is_admin_safe(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = p_user_id 
    AND role = 'admin' 
    AND status = 'aprovado'
    LIMIT 1
  );
$$;

-- 5. Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6. Create simple, non-recursive policies using the safe functions
-- Own profile access
CREATE POLICY "profiles_own_access" 
ON public.profiles 
FOR ALL 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Approved users visible to everyone (for general app functionality)
CREATE POLICY "profiles_approved_visible" 
ON public.profiles 
FOR SELECT 
USING (
  status = 'aprovado' 
  AND user_id != auth.uid()
);

-- Admin access to pending users (using safe function)
CREATE POLICY "profiles_admin_pending" 
ON public.profiles 
FOR SELECT 
USING (
  status = 'pendente' 
  AND public.is_admin_safe(auth.uid())
);

-- 7. Update the get_current_user_profile function to be more robust
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS TABLE(
  id uuid, 
  user_id uuid, 
  nome text, 
  email text, 
  role text, 
  ativo boolean, 
  username text, 
  status text, 
  created_at timestamp with time zone, 
  updated_at timestamp with time zone
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT 
    p.id, 
    p.user_id, 
    p.nome, 
    p.email, 
    p.role, 
    p.ativo, 
    p.username, 
    p.status, 
    p.created_at, 
    p.updated_at
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

-- 8. Create a safe function to get pending users for admins
CREATE OR REPLACE FUNCTION public.get_pending_users_safe()
RETURNS TABLE(
  id uuid,
  nome text,
  email text,
  username varchar,
  role text,
  created_at timestamp with time zone,
  aprovado_por_nome text
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT 
    p.id,
    p.nome,
    p.email,
    p.username,
    p.role,
    p.created_at,
    a.nome as aprovado_por_nome
  FROM public.profiles p
  LEFT JOIN public.profiles a ON p.aprovado_por = a.id
  WHERE p.status = 'pendente'
    AND public.is_admin_safe(auth.uid())
  ORDER BY p.created_at ASC;
$$;

-- 9. Log completion
INSERT INTO public.system_logs (
  timestamp,
  level,
  message,
  context
) VALUES (
  now(),
  'info',
  'Completed comprehensive profiles RLS fix - should eliminate infinite recursion',
  'MIGRATION_FINAL'
);