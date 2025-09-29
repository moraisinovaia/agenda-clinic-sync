-- Remover trigger existente se houver (fail silently)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recriar a função handle_new_user com melhor tratamento de erros
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_ipado_id UUID;
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

  -- Buscar ou criar cliente IPADO
  SELECT id INTO v_cliente_ipado_id 
  FROM public.clientes 
  WHERE nome = 'IPADO' 
  LIMIT 1;
  
  IF v_cliente_ipado_id IS NULL THEN
    INSERT INTO public.clientes (nome, ativo, configuracoes)
    VALUES ('IPADO', true, '{"tipo": "clinica", "sistema_origem": "automatic"}'::jsonb)
    RETURNING id INTO v_cliente_ipado_id;
  END IF;

  -- Criar perfil pendente
  INSERT INTO public.profiles (
    user_id, 
    nome, 
    email, 
    role, 
    status, 
    ativo,
    cliente_id
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'recepcionista',
    'pendente',
    true,
    v_cliente_ipado_id
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
      'cliente_id', v_cliente_ipado_id
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

-- Criar o trigger no schema auth (usando sintaxe específica do Supabase)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Verificar se o trigger foi criado
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';

-- Log da correção
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info',
  '[SYSTEM] Trigger on_auth_user_created corrigido definitivamente',
  'TRIGGER_FIX',
  jsonb_build_object(
    'trigger_name', 'on_auth_user_created',
    'function_name', 'handle_new_user',
    'target_table', 'auth.users'
  )
);