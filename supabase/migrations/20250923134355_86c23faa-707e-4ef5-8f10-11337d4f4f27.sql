-- Corrigir função get_pending_users para retornar user_id
CREATE OR REPLACE FUNCTION public.get_pending_users()
RETURNS TABLE(
  id uuid, 
  user_id uuid,
  nome text, 
  email text, 
  username character varying, 
  role text, 
  created_at timestamp with time zone, 
  aprovado_por_nome text
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT 
    p.id,
    p.user_id,
    p.nome,
    p.email,
    p.username,
    p.role,
    p.created_at,
    a.nome as aprovado_por_nome
  FROM public.profiles p
  LEFT JOIN public.profiles a ON p.aprovado_por = a.id
  WHERE p.status = 'pendente'
  ORDER BY p.created_at ASC;
$$;