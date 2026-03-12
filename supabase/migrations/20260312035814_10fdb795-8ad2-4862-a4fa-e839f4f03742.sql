
-- Fix 1: Update get_user_auth_data RPC to recognize super_admin as admin
CREATE OR REPLACE FUNCTION public.get_user_auth_data(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_is_clinic_admin boolean;
  v_cliente_id uuid;
BEGIN
  -- Check if user is admin OR super_admin
  SELECT EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = p_user_id AND role IN ('admin', 'super_admin')
  ) INTO v_is_admin;

  -- Check if user is clinic admin
  SELECT EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = p_user_id AND role = 'admin_clinica'
  ) INTO v_is_clinic_admin;

  -- Get cliente_id from profile
  SELECT cliente_id INTO v_cliente_id
  FROM profiles
  WHERE profiles.user_id = p_user_id
  LIMIT 1;

  RETURN json_build_object(
    'is_admin', v_is_admin,
    'is_clinic_admin', v_is_clinic_admin,
    'cliente_id', v_cliente_id
  );
END;
$$;
