-- Confirmar email da usuária aprovada que não consegue fazer login
UPDATE auth.users 
SET 
  email_confirmed_at = now(),
  confirmed_at = now()
WHERE email = 'wislannyvitoria2@gmail.com' AND email_confirmed_at IS NULL;

-- Também vamos criar uma função para admins confirmarem emails de usuários aprovados
CREATE OR REPLACE FUNCTION public.confirmar_email_usuario_aprovado(
  p_user_email text,
  p_admin_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar se quem está fazendo a ação é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = p_admin_id 
    AND role = 'admin' 
    AND status = 'aprovado'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem confirmar emails'
    );
  END IF;

  -- Verificar se o usuário está aprovado
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE email = p_user_email 
    AND status = 'aprovado'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário deve estar aprovado antes de confirmar email'
    );
  END IF;

  -- Confirmar o email
  UPDATE auth.users 
  SET 
    email_confirmed_at = now(),
    confirmed_at = now()
  WHERE email = p_user_email AND email_confirmed_at IS NULL;

  IF FOUND THEN
    RETURN json_build_object(
      'success', true,
      'message', 'Email confirmado com sucesso'
    );
  ELSE
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado ou email já confirmado'
    );
  END IF;
END;
$$;