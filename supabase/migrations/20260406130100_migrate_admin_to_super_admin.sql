-- =============================================================
-- Saneamento: migrar role 'admin' → 'super_admin'
-- Requer que a migration 20260406130000 tenha rodado antes
-- (ALTER TYPE ... ADD VALUE precisa de transação separada no PG)
-- =============================================================

-- 1. Migrar dados em user_roles
UPDATE public.user_roles
SET role = 'super_admin'::app_role
WHERE role = 'admin'::app_role;

-- =============================================================
-- 2. is_super_admin(): checar super_admin (não mais 'admin')
-- =============================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
  )
$$;

-- =============================================================
-- 3. verify_admin_access(): aceitar super_admin e admin_clinica
-- =============================================================
CREATE OR REPLACE FUNCTION public.verify_admin_access(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile RECORD;
  v_is_admin boolean;
  v_is_clinic_admin boolean;
BEGIN
  -- Aceitar tanto profile.id quanto user_id
  SELECT p.user_id, p.status, p.nome, p.email
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_profile_id OR p.user_id = p_profile_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil não encontrado');
  END IF;

  SELECT public.has_role(v_profile.user_id, 'super_admin'::app_role) INTO v_is_admin;
  SELECT public.has_role(v_profile.user_id, 'admin_clinica'::app_role) INTO v_is_clinic_admin;

  IF NOT v_is_admin AND NOT v_is_clinic_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não é administrador');
  END IF;

  IF v_profile.status != 'aprovado' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Administrador não está aprovado');
  END IF;

  RETURN jsonb_build_object(
    'success',         true,
    'user_id',         v_profile.user_id,
    'nome',            v_profile.nome,
    'email',           v_profile.email,
    'status',          v_profile.status,
    'is_admin',        v_is_admin,
    'is_clinic_admin', v_is_clinic_admin
  );
END;
$function$;

-- =============================================================
-- 4. aprovar_usuario(): checar super_admin em vez de admin
-- =============================================================
CREATE OR REPLACE FUNCTION public.aprovar_usuario(
  p_user_id UUID,
  p_aprovador_user_id UUID,
  p_cliente_id UUID DEFAULT NULL,
  p_role TEXT DEFAULT 'recepcionista'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_cliente_id UUID;
  v_default_cliente_id UUID;
  v_aprovador_cliente_id UUID;
  v_user_pending_cliente_id UUID;
  v_is_admin BOOLEAN;
  v_is_clinic_admin BOOLEAN;
BEGIN
  v_is_admin       := public.has_role(p_aprovador_user_id, 'super_admin');
  v_is_clinic_admin := public.has_role(p_aprovador_user_id, 'admin_clinica');

  IF NOT (v_is_admin OR v_is_clinic_admin) THEN
    RETURN json_build_object('success', false, 'error', 'Apenas administradores podem aprovar usuários');
  END IF;

  IF v_is_clinic_admin AND NOT v_is_admin THEN
    SELECT cliente_id INTO v_aprovador_cliente_id
    FROM public.profiles WHERE user_id = p_aprovador_user_id LIMIT 1;

    SELECT cliente_id INTO v_user_pending_cliente_id
    FROM public.profiles WHERE user_id = p_user_id LIMIT 1;

    IF v_aprovador_cliente_id IS DISTINCT FROM v_user_pending_cliente_id THEN
      RETURN json_build_object('success', false, 'error', 'Admin de clínica só pode aprovar usuários da sua própria clínica');
    END IF;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não encontrado');
  END IF;

  IF v_profile.status != 'pendente' THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não está pendente de aprovação');
  END IF;

  IF p_cliente_id IS NOT NULL THEN
    v_cliente_id := p_cliente_id;
  ELSIF v_profile.cliente_id IS NOT NULL THEN
    v_cliente_id := v_profile.cliente_id;
  ELSE
    SELECT id INTO v_default_cliente_id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1;
    v_cliente_id := v_default_cliente_id;
  END IF;

  UPDATE public.profiles
  SET
    status        = 'aprovado',
    aprovado_por  = (SELECT id FROM public.profiles WHERE user_id = p_aprovador_user_id LIMIT 1),
    data_aprovacao = NOW(),
    cliente_id    = v_cliente_id,
    ativo         = true,
    updated_at    = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (p_user_id, p_role::app_role, p_aprovador_user_id)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.system_logs (timestamp, level, message, context, user_id, data)
  VALUES (
    now(), 'info',
    '[USER_APPROVAL] Usuário aprovado: ' || v_profile.email,
    'USER_APPROVAL',
    p_aprovador_user_id,
    jsonb_build_object(
      'approved_user_id',       p_user_id,
      'approved_user_email',    v_profile.email,
      'cliente_id',             v_cliente_id,
      'role',                   p_role,
      'approver_is_clinic_admin', v_is_clinic_admin
    )
  );

  RETURN json_build_object(
    'success',    true,
    'message',    'Usuário aprovado com sucesso',
    'user_id',    p_user_id,
    'cliente_id', v_cliente_id,
    'role',       p_role
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- =============================================================
-- 5. get_user_auth_data(): já cheque IN ('admin','super_admin')
--    mas 'admin' não existirá mais — simplificar para só super_admin
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_user_auth_data(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin        boolean;
  v_is_clinic_admin boolean;
  v_cliente_id      uuid;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role = 'super_admin'
  ) INTO v_is_admin;

  SELECT EXISTS(
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role = 'admin_clinica'
  ) INTO v_is_clinic_admin;

  SELECT cliente_id INTO v_cliente_id
  FROM profiles
  WHERE profiles.user_id = p_user_id
  LIMIT 1;

  RETURN json_build_object(
    'is_admin',        v_is_admin,
    'is_clinic_admin', v_is_clinic_admin,
    'cliente_id',      v_cliente_id
  );
END;
$$;
