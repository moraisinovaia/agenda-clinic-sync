-- Fix RLS policies for IPADO users accessing profiles
-- IPADO users should be able to access main profiles table for authentication

-- Create policy for IPADO users to access main profiles table
CREATE POLICY "IPADO users can access main profiles for auth" 
ON public.profiles 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.clientes c 
    WHERE c.id = profiles.cliente_id 
    AND c.nome = 'IPADO'
    AND profiles.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clientes c 
    WHERE c.id = profiles.cliente_id 
    AND c.nome = 'IPADO'
    AND profiles.user_id = auth.uid()
  )
);

-- Ensure IPADO users can see their own profile data for authentication
CREATE POLICY "IPADO users own profile access" 
ON public.profiles 
FOR ALL 
USING (
  user_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.clientes c 
    WHERE c.id = profiles.cliente_id 
    AND c.nome = 'IPADO'
  )
)
WITH CHECK (
  user_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.clientes c 
    WHERE c.id = profiles.cliente_id 
    AND c.nome = 'IPADO'
  )
);

-- Ensure authenticated IPADO users can insert their profile on first login
CREATE POLICY "Allow IPADO profile creation" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.clientes c 
    WHERE c.id = profiles.cliente_id 
    AND c.nome = 'IPADO'
  )
);

-- Allow profile updates for IPADO users
CREATE POLICY "Allow IPADO profile updates" 
ON public.profiles 
FOR UPDATE 
USING (
  user_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.clientes c 
    WHERE c.id = profiles.cliente_id 
    AND c.nome = 'IPADO'
  )
);

-- Debug: Add logging function to help diagnose issues
CREATE OR REPLACE FUNCTION public.debug_user_access()
RETURNS jsonb AS $$
DECLARE
  current_user_id uuid;
  user_profile record;
  client_info record;
BEGIN
  current_user_id := auth.uid();
  
  -- Get user profile
  SELECT * INTO user_profile FROM public.profiles WHERE user_id = current_user_id;
  
  -- Get client info if profile exists
  IF user_profile.cliente_id IS NOT NULL THEN
    SELECT * INTO client_info FROM public.clientes WHERE id = user_profile.cliente_id;
  END IF;
  
  RETURN jsonb_build_object(
    'user_id', current_user_id,
    'profile_exists', (user_profile IS NOT NULL),
    'cliente_id', user_profile.cliente_id,
    'client_name', client_info.nome,
    'user_role', user_profile.role,
    'user_status', user_profile.status,
    'is_super_admin', (user_profile.email = 'gabworais@gmail.com' AND user_profile.role = 'admin' AND user_profile.status = 'aprovado')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;