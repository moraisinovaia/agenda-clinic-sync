-- Corrigir a função de aprovação para confirmar email automaticamente
CREATE OR REPLACE FUNCTION public.aprovar_usuario(p_user_id uuid, p_aprovador_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_email TEXT;
BEGIN
  -- Verificar se o aprovador é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = p_aprovador_id 
    AND role = 'admin' 
    AND status = 'aprovado'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem aprovar usuários'
    );
  END IF;

  -- Buscar o email do usuário
  SELECT email INTO user_email
  FROM public.profiles 
  WHERE user_id = p_user_id;

  IF user_email IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;

  -- Aprovar o usuário
  UPDATE public.profiles 
  SET 
    status = 'aprovado',
    aprovado_por = p_aprovador_id,
    data_aprovacao = now()
  WHERE user_id = p_user_id;

  -- Confirmar o email automaticamente
  UPDATE auth.users 
  SET 
    email_confirmed_at = now(),
    confirmed_at = now()
  WHERE email = user_email;

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário aprovado e email confirmado automaticamente'
  );
END;
$function$;

-- Confirmar email para o usuário marcela-ivc@hotmail.com que já foi aprovado
UPDATE auth.users 
SET 
  email_confirmed_at = now(),
  confirmed_at = now()
WHERE email = 'marcela-ivc@hotmail.com' 
  AND email_confirmed_at IS NULL;