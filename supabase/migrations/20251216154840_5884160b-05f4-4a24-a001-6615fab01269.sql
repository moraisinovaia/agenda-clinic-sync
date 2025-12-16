-- =====================================================
-- CORREÇÃO DE SEGURANÇA: profiles e audit_logs
-- =====================================================

-- 1. PROFILES: Remover política de acesso público
-- O login por username continuará funcionando via get_email_by_username() SECURITY DEFINER
DROP POLICY IF EXISTS "Allow public username lookup for login" ON public.profiles;

-- 2. AUDIT_LOGS: Criar função segura para inserção de logs
CREATE OR REPLACE FUNCTION public.insert_audit_log(
  p_action TEXT,
  p_table_name TEXT,
  p_record_id UUID,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_changed_fields TEXT[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_log_id UUID;
  v_user_id UUID;
  v_profile_name TEXT;
BEGIN
  v_user_id := auth.uid();
  
  -- Buscar nome do perfil do usuário
  SELECT nome INTO v_profile_name
  FROM public.profiles
  WHERE user_id = v_user_id
  LIMIT 1;
  
  INSERT INTO public.audit_logs (
    action,
    table_name,
    record_id,
    user_id,
    old_values,
    new_values,
    changed_fields,
    session_info,
    audit_timestamp
  ) VALUES (
    p_action,
    p_table_name,
    p_record_id,
    v_user_id,
    p_old_values,
    p_new_values,
    p_changed_fields,
    jsonb_build_object('profile_name', v_profile_name),
    now()
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 3. AUDIT_LOGS: Remover política que permite INSERT direto
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;

-- 4. AUDIT_LOGS: Manter apenas política de SELECT para admins
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;

CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- 5. Garantir que a função get_email_by_username existe e está segura
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username VARCHAR)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email
  FROM public.profiles
  WHERE LOWER(username) = LOWER(p_username)
  AND status = 'aprovado'
  AND ativo = true
  LIMIT 1;
  
  RETURN v_email;
END;
$$;