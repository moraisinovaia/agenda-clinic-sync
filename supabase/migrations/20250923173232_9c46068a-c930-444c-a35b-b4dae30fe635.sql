-- Final fix for infinite recursion in RLS policies
-- Remove ALL existing policies and create simple ones

-- Drop ALL policies on profiles table
DROP POLICY IF EXISTS "Users can access own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated profile creation" ON public.profiles;
DROP POLICY IF EXISTS "Super admin full access" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view pending profiles" ON public.profiles;
DROP POLICY IF EXISTS "Approved profiles visible" ON public.profiles;
DROP POLICY IF EXISTS "IPADO users can access main profiles for auth" ON public.profiles;
DROP POLICY IF EXISTS "IPADO users own profile access" ON public.profiles;
DROP POLICY IF EXISTS "Allow IPADO profile creation" ON public.profiles;
DROP POLICY IF EXISTS "Allow IPADO profile updates" ON public.profiles;

-- Drop the problematic function
DROP FUNCTION IF EXISTS public.get_user_client_name();

-- Create the most basic policies possible - no recursion at all

-- 1. Users can only see and modify their own profile (based on user_id)
CREATE POLICY "Own profile access" 
ON public.profiles 
FOR ALL 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2. Super admin can access all profiles (checking auth.users directly - no recursion)
CREATE POLICY "Super admin access" 
ON public.profiles 
FOR ALL 
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

-- 3. Allow profile creation during signup (basic check)
CREATE POLICY "Profile creation" 
ON public.profiles 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- 4. Public read access for usernames (for login functionality)
CREATE POLICY "Public username check" 
ON public.profiles 
FOR SELECT 
USING (true);