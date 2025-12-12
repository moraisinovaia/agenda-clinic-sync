-- ===========================================
-- ATUALIZAR FUNÇÃO aprovar_usuario
-- Permitir que admin_clinica aprove usuários da sua própria clínica
-- ===========================================

-- Recriar a função com suporte a admin_clinica
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
  -- Verificar se aprovador é admin global
  v_is_admin := public.has_role(p_aprovador_user_id, 'admin');
  
  -- Verificar se aprovador é admin de clínica
  v_is_clinic_admin := public.has_role(p_aprovador_user_id, 'admin_clinica');
  
  -- Se não for nenhum dos dois, bloquear
  IF NOT (v_is_admin OR v_is_clinic_admin) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem aprovar usuários'
    );
  END IF;
  
  -- Se for admin de clínica, obter o cliente_id do aprovador
  IF v_is_clinic_admin AND NOT v_is_admin THEN
    SELECT cliente_id INTO v_aprovador_cliente_id
    FROM public.profiles
    WHERE user_id = p_aprovador_user_id
    LIMIT 1;
    
    -- Obter o cliente_id do usuário pendente
    SELECT cliente_id INTO v_user_pending_cliente_id
    FROM public.profiles
    WHERE user_id = p_user_id
    LIMIT 1;
    
    -- Verificar se o usuário pendente é da mesma clínica
    IF v_aprovador_cliente_id IS DISTINCT FROM v_user_pending_cliente_id THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Admin de clínica só pode aprovar usuários da sua própria clínica'
      );
    END IF;
  END IF;

  -- Buscar o perfil do usuário
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;

  IF v_profile.status != 'pendente' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não está pendente de aprovação'
    );
  END IF;

  -- Determinar o cliente_id a ser usado
  IF p_cliente_id IS NOT NULL THEN
    v_cliente_id := p_cliente_id;
  ELSIF v_profile.cliente_id IS NOT NULL THEN
    v_cliente_id := v_profile.cliente_id;
  ELSE
    -- Fallback para IPADO se nenhum cliente_id fornecido
    SELECT id INTO v_default_cliente_id
    FROM public.clientes
    WHERE nome = 'IPADO'
    LIMIT 1;
    
    v_cliente_id := v_default_cliente_id;
  END IF;

  -- Atualizar o perfil do usuário
  UPDATE public.profiles
  SET 
    status = 'aprovado',
    aprovado_por = (SELECT id FROM public.profiles WHERE user_id = p_aprovador_user_id LIMIT 1),
    data_aprovacao = NOW(),
    cliente_id = v_cliente_id,
    ativo = true,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Adicionar role do usuário (se não existir)
  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (p_user_id, p_role::app_role, p_aprovador_user_id)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Log da aprovação
  INSERT INTO public.system_logs (
    timestamp, level, message, context, user_id, data
  ) VALUES (
    now(), 'info',
    '[USER_APPROVAL] Usuário aprovado: ' || v_profile.email,
    'USER_APPROVAL',
    p_aprovador_user_id,
    jsonb_build_object(
      'approved_user_id', p_user_id,
      'approved_user_email', v_profile.email,
      'cliente_id', v_cliente_id,
      'role', p_role,
      'approver_is_clinic_admin', v_is_clinic_admin
    )
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário aprovado com sucesso',
    'user_id', p_user_id,
    'cliente_id', v_cliente_id,
    'role', p_role
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;