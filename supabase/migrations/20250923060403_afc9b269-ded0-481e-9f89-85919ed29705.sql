-- Primeiro fazer DROP da função e depois recriar com cliente_id
DROP FUNCTION public.get_current_user_profile();

CREATE OR REPLACE FUNCTION public.get_current_user_profile()
 RETURNS TABLE(id uuid, user_id uuid, nome text, email text, role text, ativo boolean, username text, status text, cliente_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT 
    p.id, 
    p.user_id, 
    p.nome, 
    p.email, 
    p.role, 
    p.ativo, 
    p.username, 
    p.status, 
    p.cliente_id,
    p.created_at, 
    p.updated_at
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$function$