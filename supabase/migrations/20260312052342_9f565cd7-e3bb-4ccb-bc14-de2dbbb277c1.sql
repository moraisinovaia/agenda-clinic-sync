-- 1. Criar RPC para verificar disponibilidade de username (acessível por anon)
CREATE OR REPLACE FUNCTION public.check_username_available(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE LOWER(username) = LOWER(p_username)
  );
$$;

-- Permitir acesso anon e authenticated
GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT) TO authenticated;

-- 2. Atualizar trigger handle_new_user para tratar conflito de username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_username TEXT;
  v_nome TEXT;
  v_email TEXT;
  v_cliente_id UUID;
  v_existing_count INT;
BEGIN
  v_username := NEW.raw_user_meta_data ->> 'username';
  v_nome := COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.raw_user_meta_data ->> 'full_name', '');
  v_email := COALESCE(NEW.email, '');
  v_cliente_id := NULLIF(NEW.raw_user_meta_data ->> 'cliente_id', '')::UUID;

  -- Verificar se username já existe (case-insensitive)
  IF v_username IS NOT NULL THEN
    SELECT COUNT(*) INTO v_existing_count
    FROM public.profiles
    WHERE LOWER(username) = LOWER(v_username)
      AND user_id != NEW.id;

    IF v_existing_count > 0 THEN
      RAISE EXCEPTION 'Username "%" já está em uso. Escolha outro nome de usuário.', v_username
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  -- Verificar se já existe profile para este user_id (reativar se necessário)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.id) THEN
    UPDATE public.profiles
    SET nome = COALESCE(NULLIF(v_nome, ''), nome),
        email = COALESCE(NULLIF(v_email, ''), email),
        username = COALESCE(v_username, username),
        cliente_id = COALESCE(v_cliente_id, cliente_id),
        ativo = TRUE,
        updated_at = NOW()
    WHERE user_id = NEW.id;
    RETURN NEW;
  END IF;

  -- Inserir novo profile
  INSERT INTO public.profiles (user_id, nome, email, username, cliente_id, status, ativo)
  VALUES (
    NEW.id,
    v_nome,
    v_email,
    v_username,
    v_cliente_id,
    'pendente',
    TRUE
  );

  RETURN NEW;
END;
$$;