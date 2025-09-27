-- Criar o trigger correto para novos usuários
-- Primeiro, garantir que a função existe e está correta
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cliente_ipado_id UUID;
BEGIN
  -- Buscar ID do cliente IPADO
  SELECT id INTO v_cliente_ipado_id 
  FROM public.clientes 
  WHERE nome = 'IPADO' 
  LIMIT 1;
  
  -- Se não existe, criar cliente IPADO
  IF v_cliente_ipado_id IS NULL THEN
    INSERT INTO public.clientes (nome, ativo, configuracoes)
    VALUES ('IPADO', true, '{"tipo": "clinica", "sistema_origem": "automatic"}'::jsonb)
    RETURNING id INTO v_cliente_ipado_id;
  END IF;

  -- Inserir perfil do usuário
  INSERT INTO public.profiles (
    user_id,
    nome,
    email,
    username,
    role,
    status,
    cliente_id,
    ativo
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Usuário'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'recepcionista'),
    'pendente',
    v_cliente_ipado_id,
    true
  );
  
  -- Log da criação
  INSERT INTO public.system_logs (
    timestamp,
    level,
    message,
    context,
    user_id
  ) VALUES (
    now(),
    'info',
    'Novo perfil criado automaticamente via trigger',
    'USER_REGISTRATION',
    NEW.id
  );
  
  RETURN NEW;
END;
$$;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Criar o trigger correto na tabela auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Log da configuração do trigger
INSERT INTO public.system_logs (
  timestamp,
  level,
  message,
  context
) VALUES (
  now(),
  'info',
  'Trigger on_auth_user_created configurado com sucesso',
  'SYSTEM_SETUP'
);