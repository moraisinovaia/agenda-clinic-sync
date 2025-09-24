-- Remover políticas RLS conflitantes que podem interferir no login
DROP POLICY IF EXISTS "Login username lookup" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_pending" ON public.profiles;

-- Criar função SECURITY DEFINER para buscar email por username
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email
  FROM public.profiles
  WHERE LOWER(username) = LOWER(p_username)
    AND username IS NOT NULL
    AND trim(username) <> ''
  LIMIT 1;
  
  RETURN v_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Criar política RLS específica para login (mais permissiva para username lookup)
CREATE POLICY "Allow username lookup for login" 
ON public.profiles 
FOR SELECT 
USING (username IS NOT NULL AND trim(username) <> '');

-- Log da implementação
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info', 
  'Função get_email_by_username criada e políticas RLS atualizadas',
  'AUTH_FIX',
  jsonb_build_object(
    'action', 'created_security_definer_function',
    'function_name', 'get_email_by_username'
  )
);