-- Corrigir função get_pending_users_safe que está usando versão obsoleta is_admin_safe(auth.uid())

-- 1. Atualizar get_pending_users_safe para usar is_admin_safe() sem parâmetros
CREATE OR REPLACE FUNCTION public.get_pending_users_safe()
RETURNS TABLE(
  id uuid,
  nome text,
  email text,
  username character varying,
  role text,
  created_at timestamp with time zone,
  aprovado_por_nome text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.id,
    p.nome,
    p.email,
    p.username,
    p.role,
    p.created_at,
    a.nome as aprovado_por_nome
  FROM public.profiles p
  LEFT JOIN public.profiles a ON p.aprovado_por = a.id
  WHERE p.status = 'pendente'
    AND public.is_admin_safe()
  ORDER BY p.created_at ASC;
$$;

-- 2. Criar função para listar usuários aprovados (sem o usuário atual)
CREATE OR REPLACE FUNCTION public.get_approved_users_safe()
RETURNS TABLE(
  id uuid,
  nome text,
  email text,
  username character varying,
  role text,
  status character varying,
  created_at timestamp with time zone,
  data_aprovacao timestamp with time zone,
  user_id uuid,
  email_confirmed boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.id,
    p.nome,
    p.email,
    p.username,
    p.role,
    p.status,
    p.created_at,
    p.data_aprovacao,
    p.user_id,
    (au.email_confirmed_at IS NOT NULL) as email_confirmed
  FROM public.profiles p
  LEFT JOIN auth.users au ON p.user_id = au.id
  WHERE p.status = 'aprovado'
    AND p.user_id != auth.uid()
    AND public.is_admin_safe()
  ORDER BY p.data_aprovacao DESC;
$$;

-- 3. Log da correção
INSERT INTO public.system_logs (
  timestamp, level, message, context
) VALUES (
  now(), 'info', 
  'Corrigidas funções RPC para usar is_admin_safe() sem parâmetros',
  'USER_APPROVAL_FUNCTIONS_FIX'
);