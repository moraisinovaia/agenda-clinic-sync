-- ============================================================================
-- CORREÇÃO: Recursão Infinita nas Políticas RLS de Profiles
-- ============================================================================
-- Problema: Política "Ver profiles aprovados mesma clinica" causa recursão
-- ao fazer subquery em profiles que aciona as políticas RLS novamente
-- ============================================================================

-- 1. Corrigir função get_user_cliente_id() para bypassar RLS completamente
CREATE OR REPLACE FUNCTION public.get_user_cliente_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_cliente_id uuid;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Esta query NÃO aciona políticas RLS porque SECURITY DEFINER + search_path correto
  SELECT cliente_id INTO v_cliente_id
  FROM public.profiles 
  WHERE user_id = v_user_id 
  LIMIT 1;
  
  RETURN v_cliente_id;
END;
$$;

-- Garantir ownership correto
ALTER FUNCTION public.get_user_cliente_id() OWNER TO postgres;

-- 2. Remover política RLS problemática que causa recursão
DROP POLICY IF EXISTS "Ver profiles aprovados mesma clinica" ON public.profiles;

-- 3. Limpar políticas duplicadas em profiles
DROP POLICY IF EXISTS "Own profile access" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_access" ON public.profiles;
DROP POLICY IF EXISTS "profiles_approved_visible" ON public.profiles;

-- 4. Criar política consolidada e otimizada para visualizar profiles aprovados
CREATE POLICY "Ver profiles aprovados da mesma clinica"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Usuário pode ver seu próprio perfil
  user_id = auth.uid()
  OR
  -- Ou pode ver perfis aprovados da mesma clínica (sem recursão)
  (
    status = 'aprovado'::character varying
    AND cliente_id = get_user_cliente_id()
    AND user_id <> auth.uid()
  )
);

-- 5. Comentários de documentação
COMMENT ON FUNCTION public.get_user_cliente_id() IS 
'Retorna o cliente_id do usuário autenticado. SECURITY DEFINER bypassa RLS para evitar recursão.';

COMMENT ON POLICY "Ver profiles aprovados da mesma clinica" ON public.profiles IS 
'Permite usuários verem seu próprio perfil e perfis aprovados da mesma clínica. Usa get_user_cliente_id() para evitar recursão infinita.';