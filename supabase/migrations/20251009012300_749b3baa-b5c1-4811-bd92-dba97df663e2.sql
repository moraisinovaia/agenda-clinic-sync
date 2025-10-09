-- Adicionar campo cargo na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cargo VARCHAR(50) DEFAULT 'recepcionista';

-- Atualizar usuários existentes para terem cargo = 'recepcionista' (exceto admins)
UPDATE public.profiles 
SET cargo = 'recepcionista'
WHERE cargo IS NULL 
  AND id NOT IN (
    SELECT p.id 
    FROM public.profiles p 
    INNER JOIN public.user_roles ur ON ur.user_id = p.user_id 
    WHERE ur.role = 'admin'
  );

-- Atualizar admins para terem cargo = 'administrador'
UPDATE public.profiles 
SET cargo = 'administrador'
WHERE id IN (
  SELECT p.id 
  FROM public.profiles p 
  INNER JOIN public.user_roles ur ON ur.user_id = p.user_id 
  WHERE ur.role = 'admin'
);

-- Drop e recriar get_pending_users_safe com campo cargo
DROP FUNCTION IF EXISTS public.get_pending_users_safe();

CREATE FUNCTION public.get_pending_users_safe()
RETURNS TABLE(
  id uuid,
  nome text,
  email text,
  username varchar,
  cargo varchar,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.nome,
    p.email,
    p.username,
    COALESCE(p.cargo, 'recepcionista') as cargo,
    p.created_at
  FROM public.profiles p
  WHERE p.status = 'pendente'
    AND (
      p.cliente_id = public.get_user_cliente_id()
      OR public.has_role(auth.uid(), 'admin')
    )
  ORDER BY p.created_at DESC;
$$;

-- Drop e recriar get_approved_users_safe com campo cargo
DROP FUNCTION IF EXISTS public.get_approved_users_safe();

CREATE FUNCTION public.get_approved_users_safe()
RETURNS TABLE(
  id uuid,
  nome text,
  email text,
  username varchar,
  cargo varchar,
  status varchar,
  created_at timestamptz,
  data_aprovacao timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.nome,
    p.email,
    p.username,
    COALESCE(p.cargo, 'recepcionista') as cargo,
    p.status,
    p.created_at,
    p.data_aprovacao
  FROM public.profiles p
  WHERE p.status = 'aprovado'
    AND (
      p.cliente_id = public.get_user_cliente_id()
      OR public.has_role(auth.uid(), 'admin')
    )
  ORDER BY p.created_at DESC;
$$;

-- Atualizar trigger para garantir que novos usuários tenham cargo
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
  v_username text;
BEGIN
  -- Buscar cliente_id padrão (INOVAIA)
  SELECT id INTO v_cliente_id 
  FROM public.clientes 
  WHERE nome = 'INOVAIA' 
  LIMIT 1;
  
  -- Se não existe cliente INOVAIA, criar
  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (nome, ativo, configuracoes)
    VALUES ('INOVAIA', true, '{"tipo": "clinica", "sistema_origem": "automatic"}'::jsonb)
    RETURNING id INTO v_cliente_id;
  END IF;

  -- Extrair username dos metadados ou usar parte do email
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );
  
  -- Inserir perfil com cargo padrão
  INSERT INTO public.profiles (
    user_id,
    nome,
    email,
    username,
    cliente_id,
    status,
    cargo,
    ativo
  ) VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'nome',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    v_username,
    v_cliente_id,
    'pendente',
    'recepcionista', -- cargo padrão
    true
  );
  
  RETURN NEW;
END;
$$;

-- Log da migração
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info',
  '[FIX] Campo cargo adicionado e funções de usuário atualizadas',
  'USER_CARGO_MIGRATION',
  jsonb_build_object(
    'changes', ARRAY[
      'Adicionado campo cargo em profiles',
      'Atualizadas funções get_pending_users_safe e get_approved_users_safe',
      'Atualizado trigger handle_new_user para incluir cargo',
      'Separação entre role (permissão) e cargo (função clínica)'
    ]
  )
);