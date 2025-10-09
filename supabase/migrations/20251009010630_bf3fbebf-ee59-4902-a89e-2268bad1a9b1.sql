-- Atualizar função handle_new_user para usar cliente INOVAIA como padrão
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cliente_principal_id UUID;
BEGIN
  -- Log da tentativa de criação
  INSERT INTO public.system_logs (
    timestamp, level, message, context, data
  ) VALUES (
    now(), 'info',
    '[AUTH] Novo usuário registrado - criando perfil',
    'USER_REGISTRATION',
    jsonb_build_object(
      'user_id', NEW.id,
      'email', NEW.email,
      'created_at', NEW.created_at
    )
  );

  -- Buscar cliente INOVAIA (principal) ou criar se não existir
  SELECT id INTO v_cliente_principal_id 
  FROM public.clientes 
  WHERE nome = 'INOVAIA' 
  LIMIT 1;
  
  IF v_cliente_principal_id IS NULL THEN
    -- Se INOVAIA não existe, buscar o primeiro cliente ativo
    SELECT id INTO v_cliente_principal_id 
    FROM public.clientes 
    WHERE ativo = true
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  
  IF v_cliente_principal_id IS NULL THEN
    -- Se não há nenhum cliente, criar INOVAIA
    INSERT INTO public.clientes (nome, ativo, configuracoes)
    VALUES ('INOVAIA', true, '{"tipo": "clinica", "sistema_origem": "automatic"}'::jsonb)
    RETURNING id INTO v_cliente_principal_id;
  END IF;

  -- Criar perfil pendente
  INSERT INTO public.profiles (
    user_id, 
    nome, 
    email, 
    status, 
    ativo,
    cliente_id
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'pendente',
    true,
    v_cliente_principal_id
  );

  -- Log de sucesso
  INSERT INTO public.system_logs (
    timestamp, level, message, context, data
  ) VALUES (
    now(), 'info',
    '[AUTH] Perfil criado com sucesso para novo usuário',
    'PROFILE_CREATED',
    jsonb_build_object(
      'user_id', NEW.id,
      'email', NEW.email,
      'cliente_id', v_cliente_principal_id,
      'status', 'pendente'
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro
    INSERT INTO public.system_logs (
      timestamp, level, message, context, data
    ) VALUES (
      now(), 'error',
      '[AUTH] Erro ao criar perfil para novo usuário: ' || SQLERRM,
      'PROFILE_CREATION_ERROR',
      jsonb_build_object(
        'user_id', NEW.id,
        'email', NEW.email,
        'error', SQLERRM
      )
    );
    
    -- Retornar NEW mesmo com erro para não bloquear o cadastro
    RETURN NEW;
END;
$$;