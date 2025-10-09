-- Criar função auxiliar para verificar admin na Edge Function
-- Esta função tem SECURITY DEFINER então bypassa RLS automaticamente

CREATE OR REPLACE FUNCTION public.verify_admin_access(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_profile RECORD;
  v_is_admin boolean;
BEGIN
  -- Buscar profile
  SELECT p.user_id, p.status, p.nome, p.email
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_profile_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Perfil não encontrado'
    );
  END IF;
  
  -- Verificar se é admin
  SELECT public.has_role(v_profile.user_id, 'admin'::app_role)
  INTO v_is_admin;
  
  -- Verificar se está aprovado
  IF NOT v_is_admin THEN
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
    'status', v_profile.status
  );
END;
$$;

-- Log da criação
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info',
  '[SECURITY] Função verify_admin_access criada para Edge Functions',
  'DATABASE_MIGRATION',
  jsonb_build_object(
    'function', 'verify_admin_access',
    'security', 'definer',
    'purpose', 'Verificar admin em Edge Functions sem problema de RLS'
  )
);