-- 1. Realinhar profiles existentes com o parceiro da clínica
UPDATE public.profiles p
SET parceiro_id = c.parceiro_id
FROM public.clientes c
WHERE p.cliente_id = c.id
  AND p.parceiro_id IS DISTINCT FROM c.parceiro_id;

-- 2. Recriar handle_new_user com suporte completo a cliente/parceiro
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
  v_parceiro_id UUID;
  v_cliente_ativo BOOLEAN;
  v_existing_count INT;
BEGIN
  -- Normalização básica
  v_username := LOWER(NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'username'), ''));
  v_nome := COALESCE(
    NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'nome'), ''),
    NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    'Usuário'
  );
  v_email := COALESCE(NULLIF(BTRIM(NEW.email), ''), '');
  v_cliente_id := NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'cliente_id'), '')::UUID;

  -- Email interno é obrigatório para o auth funcionar corretamente
  IF v_email = '' THEN
    RAISE EXCEPTION 'Email interno do cadastro não foi gerado.'
      USING ERRCODE = '23502';
  END IF;

  -- Username único (case-insensitive)
  IF v_username IS NOT NULL THEN
    SELECT COUNT(*)
      INTO v_existing_count
    FROM public.profiles
    WHERE LOWER(BTRIM(username)) = v_username
      AND user_id <> NEW.id;

    IF v_existing_count > 0 THEN
      RAISE EXCEPTION 'Username "%" já está em uso. Escolha outro nome de usuário.', v_username
        USING ERRCODE = '23505';
    END IF;
  END IF;

  -- Clínica obrigatória
  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Selecione uma clínica válida para concluir o cadastro.'
      USING ERRCODE = '23502';
  END IF;

  -- Buscar clínica e parceiro
  SELECT c.ativo, c.parceiro_id
    INTO v_cliente_ativo, v_parceiro_id
  FROM public.clientes c
  WHERE c.id = v_cliente_id
  LIMIT 1;

  -- Clínica inexistente
  IF v_cliente_ativo IS NULL THEN
    RAISE EXCEPTION 'A clínica selecionada não existe.'
      USING ERRCODE = '23503';
  END IF;

  -- Clínica inativa
  IF v_cliente_ativo IS NOT TRUE THEN
    RAISE EXCEPTION 'A clínica selecionada está inativa para cadastro.'
      USING ERRCODE = '23503';
  END IF;

  -- Parceiro obrigatório, pois profiles.parceiro_id é NOT NULL
  IF v_parceiro_id IS NULL THEN
    RAISE EXCEPTION 'A clínica selecionada não possui parceiro vinculado.'
      USING ERRCODE = '23502';
  END IF;

  -- Se já existe profile para este user_id, atualiza e reativa
  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = NEW.id
  ) THEN
    UPDATE public.profiles
    SET nome = COALESCE(v_nome, nome),
        email = v_email,
        username = COALESCE(v_username, username),
        cliente_id = v_cliente_id,
        parceiro_id = v_parceiro_id,
        ativo = TRUE,
        updated_at = NOW()
    WHERE user_id = NEW.id;

    RETURN NEW;
  END IF;

  -- Inserir novo profile
  INSERT INTO public.profiles (
    user_id,
    nome,
    email,
    username,
    cliente_id,
    parceiro_id,
    status,
    ativo
  )
  VALUES (
    NEW.id,
    v_nome,
    v_email,
    v_username,
    v_cliente_id,
    v_parceiro_id,
    'pendente',
    TRUE
  );

  RETURN NEW;
END;
$$;

-- 3. Garantir que o trigger on_auth_user_created esteja apontando para a função atual
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();