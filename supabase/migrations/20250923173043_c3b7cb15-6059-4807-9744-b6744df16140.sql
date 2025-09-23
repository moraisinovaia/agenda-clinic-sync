-- Fix infinite recursion in RLS policies for profiles table
-- Remove problematic policies that cause recursion

-- Remove the problematic IPADO policies that cause infinite recursion
DROP POLICY IF EXISTS "IPADO users can access main profiles for auth" ON public.profiles;
DROP POLICY IF EXISTS "IPADO users own profile access" ON public.profiles;
DROP POLICY IF EXISTS "Allow IPADO profile creation" ON public.profiles;
DROP POLICY IF EXISTS "Allow IPADO profile updates" ON public.profiles;

-- Create a security definer function to safely check user's client
CREATE OR REPLACE FUNCTION public.get_user_client_name()
RETURNS TEXT AS $$
DECLARE
  user_profile record;
  client_name text;
BEGIN
  -- Get user profile without triggering RLS
  SELECT * INTO user_profile 
  FROM public.profiles 
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  -- If no profile found, return null
  IF user_profile.cliente_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get client name
  SELECT nome INTO client_name
  FROM public.clientes 
  WHERE id = user_profile.cliente_id;
  
  RETURN client_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Simplified policies that don't cause recursion
-- Users can only access their own profile data
CREATE POLICY "Users can access own profile" 
ON public.profiles 
FOR ALL 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow profile creation for authenticated users
CREATE POLICY "Allow authenticated profile creation" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Super admin can access all profiles (without recursion)
CREATE POLICY "Super admin full access" 
ON public.profiles 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email = 'gabworais@gmail.com'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email = 'gabworais@gmail.com'
  )
);

-- Admins can view pending profiles (using the safe function)
CREATE POLICY "Admins can view pending profiles" 
ON public.profiles 
FOR SELECT 
USING (
  status = 'pendente' 
  AND EXISTS (
    SELECT 1 FROM public.profiles p2
    WHERE p2.user_id = auth.uid()
    AND p2.role = 'admin'
    AND p2.status = 'aprovado'
  )
);

-- Allow viewing approved profiles (simplified)
CREATE POLICY "Approved profiles visible" 
ON public.profiles 
FOR SELECT 
USING (status = 'aprovado' AND user_id != auth.uid());