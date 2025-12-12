-- Função RPC para buscar usuários pendentes filtrados por clínica (para admin da clínica)
CREATE OR REPLACE FUNCTION public.get_pending_users_for_clinic(p_cliente_id uuid)
RETURNS TABLE(
  id uuid,
  nome text,
  email text,
  username text,
  cargo text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verificar se o usuário é admin ou admin_clinica
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'admin_clinica')
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem listar usuários pendentes';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.nome,
    p.email,
    p.username,
    p.cargo,
    p.created_at
  FROM public.profiles p
  WHERE p.status = 'pendente'
    AND p.cliente_id = p_cliente_id
  ORDER BY p.created_at DESC;
END;
$$;

-- Função RPC para buscar usuários aprovados filtrados por clínica (para admin da clínica)
CREATE OR REPLACE FUNCTION public.get_approved_users_for_clinic(p_cliente_id uuid)
RETURNS TABLE(
  id uuid,
  nome text,
  email text,
  username text,
  cargo text,
  status text,
  created_at timestamptz,
  data_aprovacao timestamptz,
  cliente_nome text,
  user_id uuid,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verificar se o usuário é admin ou admin_clinica
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'admin_clinica')
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem listar usuários aprovados';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.nome,
    p.email,
    p.username,
    p.cargo,
    p.status,
    p.created_at,
    p.data_aprovacao,
    c.nome as cliente_nome,
    p.user_id,
    COALESCE(ur.role::text, 'recepcionista') as role
  FROM public.profiles p
  LEFT JOIN public.clientes c ON p.cliente_id = c.id
  LEFT JOIN public.user_roles ur ON p.user_id = ur.user_id
  WHERE p.status = 'aprovado'
    AND p.cliente_id = p_cliente_id
  ORDER BY p.data_aprovacao DESC NULLS LAST, p.created_at DESC;
END;
$$;

-- Função para buscar clínicas ativas (pública para signup)
CREATE OR REPLACE FUNCTION public.get_clinicas_para_signup()
RETURNS TABLE(
  id uuid,
  nome text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.nome
  FROM public.clientes c
  WHERE c.ativo = true
  ORDER BY c.nome;
END;
$$;

-- Atualizar trigger handle_new_user para aceitar cliente_id dos metadados
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_cliente_id UUID;
  v_nome TEXT;
  v_username TEXT;
BEGIN
  -- Obter dados dos metadados
  v_nome := NEW.raw_user_meta_data->>'nome';
  v_username := NEW.raw_user_meta_data->>'username';
  v_cliente_id := (NEW.raw_user_meta_data->>'cliente_id')::UUID;
  
  -- Se não tiver cliente_id, usar IPADO como padrão
  IF v_cliente_id IS NULL THEN
    SELECT id INTO v_cliente_id
    FROM public.clientes
    WHERE nome = 'IPADO'
    LIMIT 1;
  END IF;
  
  -- Inserir profile com cliente_id
  INSERT INTO public.profiles (
    user_id, 
    email, 
    nome, 
    username, 
    status, 
    ativo,
    cliente_id
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(v_nome, 'Novo Usuário'),
    v_username,
    'pendente',
    true,
    v_cliente_id
  );
  
  RETURN NEW;
END;
$$;