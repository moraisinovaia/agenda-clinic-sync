-- Fix get_approved_users_for_email_fix return type mismatch
CREATE OR REPLACE FUNCTION public.get_approved_users_for_email_fix()
RETURNS TABLE(
  user_id uuid,
  nome text,
  email text,
  status text,
  data_aprovacao timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    p.user_id,
    p.nome::text,
    p.email::text,
    p.status::text,
    p.data_aprovacao
  FROM public.profiles p
  WHERE p.status = 'aprovado';
END;
$function$;