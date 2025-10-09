-- CORREÇÃO CRÍTICA: Remover INSERT de funções STABLE
-- Problema: INSERT não é permitido em funções STABLE, causando erro e lista vazia

-- 1. Remover funções com problema
DROP FUNCTION IF EXISTS public.get_pending_users_safe();
DROP FUNCTION IF EXISTS public.get_approved_users_safe();

-- 2. Recriar get_pending_users_safe SEM logs internos
CREATE OR REPLACE FUNCTION public.get_pending_users_safe()
RETURNS TABLE(
  id uuid,
  nome text,
  email text,
  username varchar,
  cargo varchar,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verificar se é admin
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem visualizar usuários pendentes';
  END IF;

  -- Retornar TODOS os usuários pendentes (sem filtro de cliente)
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
  ORDER BY p.created_at DESC;
END;
$$;

-- 3. Recriar get_approved_users_safe SEM logs internos
CREATE OR REPLACE FUNCTION public.get_approved_users_safe()
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verificar se é admin
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem visualizar usuários aprovados';
  END IF;

  -- Retornar TODOS os usuários aprovados (sem filtro de cliente)
  RETURN QUERY
  SELECT 
    p.id,
    p.nome,
    p.email,
    p.username,
    p.cargo,
    p.status,
    p.created_at,
    p.data_aprovacao
  FROM public.profiles p
  WHERE p.status = 'aprovado'
  ORDER BY p.created_at DESC;
END;
$$;