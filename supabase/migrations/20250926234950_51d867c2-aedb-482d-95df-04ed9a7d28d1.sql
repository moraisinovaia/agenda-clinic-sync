-- Drop existing function and recreate
DROP FUNCTION IF EXISTS public.get_current_user_profile();

-- Função para garantir cliente_id para usuários
CREATE OR REPLACE FUNCTION public.ensure_user_cliente_id()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
  
  -- Atualizar usuários sem cliente_id
  UPDATE public.profiles 
  SET cliente_id = v_cliente_ipado_id
  WHERE cliente_id IS NULL;
END;
$$;

-- Função para buscar email por username
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT email FROM public.profiles 
  WHERE username = p_username 
  AND ativo = true 
  LIMIT 1;
$$;

-- Função para buscar perfil do usuário atual
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  nome text,
  email text,
  role text,
  ativo boolean,
  status character varying,
  username character varying,
  cliente_id uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    p.id,
    p.user_id,
    p.nome,
    p.email,
    p.role,
    p.ativo,
    p.status,
    p.username,
    p.cliente_id,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

-- Executar a função para corrigir usuários existentes
SELECT public.ensure_user_cliente_id();