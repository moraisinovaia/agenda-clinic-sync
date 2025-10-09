-- Permitir recadastro de usuários rejeitados
-- Quando um usuário rejeitado tenta se cadastrar novamente, 
-- atualizar o status para 'pendente' ao invés de falhar

-- 1. Modificar o trigger de criação de profile para lidar com usuários rejeitados
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_existing_profile_id uuid;
  v_existing_status varchar;
BEGIN
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
      nome = COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', email),
      email = NEW.email,
      username = NEW.raw_user_meta_data->>'username',
      cargo = COALESCE(NEW.raw_user_meta_data->>'cargo', 'recepcionista'),
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
      COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', NEW.email),
      NEW.email,
      NEW.raw_user_meta_data->>'username',
      COALESCE(NEW.raw_user_meta_data->>'cargo', 'recepcionista'),
      'pendente'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Garantir que o trigger existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Atualizar manualmente o usuário que tentou se recadastrar
UPDATE public.profiles
SET status = 'pendente', updated_at = now()
WHERE email = 'lss190787@gmail.com' 
AND status = 'rejeitado';