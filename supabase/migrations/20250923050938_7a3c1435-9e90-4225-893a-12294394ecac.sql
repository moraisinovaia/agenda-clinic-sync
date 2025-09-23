-- Corrigir trigger para não vincular automaticamente ao cliente IPADO
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Inserir perfil sem cliente_id (será definido na aprovação)
  INSERT INTO public.profiles (user_id, nome, email, role, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'recepcionista'),
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Criar função para aprovar usuário com cliente específico
CREATE OR REPLACE FUNCTION public.aprovar_usuario(
  p_user_id uuid, 
  p_aprovador_id uuid,
  p_cliente_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verificar se o aprovador é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = p_aprovador_id 
    AND role = 'admin' 
    AND status = 'aprovado'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem aprovar usuários'
    );
  END IF;

  -- Verificar se o cliente existe
  IF NOT EXISTS (
    SELECT 1 FROM public.clientes 
    WHERE id = p_cliente_id AND ativo = true
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cliente não encontrado ou inativo'
    );
  END IF;

  -- Aprovar o usuário e vincular ao cliente
  UPDATE public.profiles 
  SET 
    status = 'aprovado',
    cliente_id = p_cliente_id,
    aprovado_por = p_aprovador_id,
    data_aprovacao = now()
  WHERE user_id = p_user_id AND status = 'pendente';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado ou já foi processado'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário aprovado e vinculado ao cliente'
  );
END;
$$;

-- Remover constraint NOT NULL do cliente_id na tabela profiles temporariamente para usuários pendentes
ALTER TABLE public.profiles ALTER COLUMN cliente_id DROP NOT NULL;