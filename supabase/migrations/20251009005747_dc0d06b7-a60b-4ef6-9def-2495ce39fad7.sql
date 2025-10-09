-- Criar função para buscar auth.user_id de um profile de forma segura
CREATE OR REPLACE FUNCTION public.get_profile_auth_id(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_nome text;
  v_email text;
BEGIN
  SELECT user_id, nome, email 
  INTO v_user_id, v_nome, v_email
  FROM public.profiles
  WHERE id = p_profile_id;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Perfil não encontrado'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'nome', v_nome,
    'email', v_email
  );
END;
$$;