-- Fix RLS policies for profiles to allow better access control

-- Drop problematic policies
DROP POLICY IF EXISTS "profiles_select_approved" ON public.profiles;
DROP POLICY IF EXISTS "users_can_see_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "admins_can_see_all_profiles" ON public.profiles;

-- Create better policies that allow users to see their own profile regardless of status
-- but only see other approved profiles

-- Policy 1: Users can always see their own profile (even if pending)
CREATE POLICY "users_can_see_own_profile" ON public.profiles
FOR SELECT USING (user_id = auth.uid());

-- Policy 2: Users can see other profiles only if they are approved
CREATE POLICY "users_can_see_approved_profiles" ON public.profiles
FOR SELECT USING (user_id != auth.uid() AND status = 'aprovado');

-- Policy 3: Admins can see all profiles (for approval management)
CREATE POLICY "admins_can_see_all_profiles" ON public.profiles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles admin_profile
    WHERE admin_profile.user_id = auth.uid()
    AND admin_profile.role = 'admin'
    AND admin_profile.status = 'aprovado'
  )
);

-- Policy 4: Allow approved users to update their own profile
CREATE POLICY "approved_users_can_update_own_profile" ON public.profiles
FOR UPDATE 
USING (user_id = auth.uid() AND status = 'aprovado')
WITH CHECK (user_id = auth.uid() AND status = 'aprovado');

-- Create function to check if user can access system (approved status)
CREATE OR REPLACE FUNCTION public.user_can_access_system()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND status = 'aprovado'
  );
$$;