-- Fix verify_admin_access to accept user_id instead of profile.id
CREATE OR REPLACE FUNCTION public.verify_admin_access(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_profile RECORD;
  v_is_admin boolean;
  v_is_clinic_admin boolean;
BEGIN
  -- Buscar profile - aceitar tanto profile.id quanto user_id
  SELECT p.user_id, p.status, p.nome, p.email
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_profile_id OR p.user_id = p_profile_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Perfil não encontrado'
    );
  END IF;
  
  -- Verificar se é admin global
  SELECT public.has_role(v_profile.user_id, 'admin'::app_role)
  INTO v_is_admin;
  
  -- Verificar se é admin de clínica
  SELECT public.has_role(v_profile.user_id, 'admin_clinica'::app_role)
  INTO v_is_clinic_admin;
  
  -- Verificar se é algum tipo de admin
  IF NOT v_is_admin AND NOT v_is_clinic_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuário não é administrador'
    );
  END IF;
  
  IF v_profile.status != 'aprovado' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Administrador não está aprovado'
    );
  END IF;
  
  -- Retornar sucesso com dados do admin
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_profile.user_id,
    'nome', v_profile.nome,
    'email', v_profile.email,
    'status', v_profile.status,
    'is_admin', v_is_admin,
    'is_clinic_admin', v_is_clinic_admin
  );
END;
$function$;