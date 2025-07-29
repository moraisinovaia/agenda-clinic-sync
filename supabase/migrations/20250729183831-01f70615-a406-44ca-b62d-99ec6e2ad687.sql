-- Executar correção manual do email da Marcela
DO $$
DECLARE
  marcela_user_id UUID;
BEGIN
  -- Buscar o user_id da Marcela
  SELECT user_id INTO marcela_user_id 
  FROM public.profiles 
  WHERE email = 'marcela-ivc@hotmail.com' 
  AND status = 'aprovado';
  
  IF marcela_user_id IS NOT NULL THEN
    -- Confirmar o email diretamente na tabela auth.users
    UPDATE auth.users 
    SET 
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      confirmed_at = COALESCE(confirmed_at, now())
    WHERE id = marcela_user_id;
    
    RAISE NOTICE 'Email confirmado para Marcela com user_id: %', marcela_user_id;
  ELSE
    RAISE NOTICE 'Usuário Marcela não encontrado ou não aprovado';
  END IF;
END $$;