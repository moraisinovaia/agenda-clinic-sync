-- Primeiro, verificar e criar a função handle_new_user se não existir
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
    COALESCE((NEW.raw_user_meta_data->>'cliente_id')::UUID, v_cliente_ipado_id),
    true
  );
  
  RETURN NEW;
END;
$$;

-- Criar o trigger na tabela auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Criar perfis para usuários órfãos (que existem em auth.users mas não em profiles)
WITH orphan_users AS (
  SELECT 
    au.id,
    au.email,
    au.raw_user_meta_data,
    au.created_at
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.user_id
  WHERE p.user_id IS NULL
),
cliente_ipado AS (
  SELECT id as cliente_id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1
)
INSERT INTO public.profiles (
  user_id,
  nome,
  email,
  username,
  role,
  status,
  cliente_id,
  ativo,
  created_at
)
SELECT 
  ou.id,
  COALESCE(ou.raw_user_meta_data->>'nome', 'Usuário Órfão'),
  ou.email,
  COALESCE(ou.raw_user_meta_data->>'username', split_part(ou.email, '@', 1)),
  COALESCE(ou.raw_user_meta_data->>'role', 'recepcionista'),
  'pendente',
  ci.cliente_id,
  true,
  ou.created_at
FROM orphan_users ou
CROSS JOIN cliente_ipado ci;