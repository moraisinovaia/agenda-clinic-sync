-- Corrigir trigger para garantir que username seja coletado corretamente
-- Problema: Quando reativa usuário rejeitado, o username não é atualizado

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_existing_profile_id uuid;
  v_existing_status varchar;
  v_username text;
  v_nome text;
  v_cargo text;
BEGIN
  -- Extrair username e nome do metadata de forma mais robusta
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    SPLIT_PART(NEW.email, '@', 1) -- Fallback: usar parte do email antes do @
  );
  
  v_nome := COALESCE(
    NEW.raw_user_meta_data->>'nome',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1) -- Fallback: usar parte do email
  );
  
  v_cargo := COALESCE(
    NEW.raw_user_meta_data->>'cargo',
    NEW.raw_user_meta_data->>'role',
    'recepcionista'
  );
  
  -- Verificar se já existe um profile para este usuário
  SELECT id, status INTO v_existing_profile_id, v_existing_status
  FROM public.profiles
  WHERE user_id = NEW.id
  LIMIT 1;
  
  -- Se o profile existe e foi rejeitado, reativar como pendente
  IF v_existing_profile_id IS NOT NULL AND v_existing_status = 'rejeitado' THEN
    UPDATE public.profiles
    SET 
      status = 'pendente',
      nome = v_nome,
      email = NEW.email,
      username = v_username,
      cargo = v_cargo,
      updated_at = now()
    WHERE id = v_existing_profile_id;
    
    -- Log da reativação
    INSERT INTO public.system_logs (
      timestamp, level, message, context, data
    ) VALUES (
      now(), 'info',
      'Usuário rejeitado reativado como pendente',
      'USER_REACTIVATION',
      jsonb_build_object(
        'user_id', NEW.id,
        'email', NEW.email,
        'username', v_username,
        'profile_id', v_existing_profile_id
      )
    );
    
  -- Se não existe profile, criar novo
  ELSIF v_existing_profile_id IS NULL THEN
    INSERT INTO public.profiles (
      user_id,
      nome,
      email,
      username,
      cargo,
      status
    ) VALUES (
      NEW.id,
      v_nome,
      NEW.email,
      v_username,
      v_cargo,
      'pendente'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recriar trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Atualizar usuário específico com username derivado do email
UPDATE public.profiles
SET 
  username = SPLIT_PART(email, '@', 1),
  updated_at = now()
WHERE email = 'lss190787@gmail.com' 
AND (username IS NULL OR username = '');