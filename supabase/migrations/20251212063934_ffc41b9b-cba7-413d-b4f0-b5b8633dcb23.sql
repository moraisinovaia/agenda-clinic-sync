-- Drop existing function to recreate with new signature
DROP FUNCTION IF EXISTS public.aprovar_usuario(uuid, uuid);
DROP FUNCTION IF EXISTS public.aprovar_usuario(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.aprovar_usuario(uuid, uuid, uuid, text);

-- Recreate aprovar_usuario with support for p_cliente_id and p_role
CREATE OR REPLACE FUNCTION public.aprovar_usuario(
  p_user_id uuid,
  p_aprovador_user_id uuid,
  p_cliente_id uuid DEFAULT NULL,
  p_role text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_final_id uuid;
  v_profile_id uuid;
  v_user_nome text;
BEGIN
  -- Verificar se aprovador é admin
  IF NOT public.has_role(p_aprovador_user_id, 'admin') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem aprovar usuários'
    );
  END IF;

  -- Verificar se usuário existe e está pendente
  SELECT id, nome INTO v_profile_id, v_user_nome
  FROM public.profiles
  WHERE user_id = p_user_id AND status = 'pendente';

  IF v_profile_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado ou não está pendente'
    );
  END IF;

  -- Determinar cliente_id final (usar fornecido ou fallback para IPADO)
  IF p_cliente_id IS NOT NULL THEN
    v_cliente_final_id := p_cliente_id;
  ELSE
    SELECT id INTO v_cliente_final_id 
    FROM public.clientes 
    WHERE nome = 'IPADO' 
    LIMIT 1;
  END IF;

  -- Atualizar profile com aprovação e cliente
  UPDATE public.profiles
  SET 
    status = 'aprovado',
    aprovado_por = v_profile_id,
    data_aprovacao = now(),
    cliente_id = v_cliente_final_id,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- Inserir role se fornecida (e não for recepcionista que é o padrão implícito)
  IF p_role IS NOT NULL AND p_role != 'recepcionista' THEN
    INSERT INTO public.user_roles (user_id, role, created_by)
    VALUES (p_user_id, p_role::app_role, p_aprovador_user_id)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Log da aprovação
  INSERT INTO public.system_logs (timestamp, level, message, context, user_id, data)
  VALUES (
    now(), 'info',
    'Usuário aprovado: ' || v_user_nome,
    'USER_APPROVAL',
    p_aprovador_user_id,
    jsonb_build_object(
      'approved_user_id', p_user_id,
      'cliente_id', v_cliente_final_id,
      'role', COALESCE(p_role, 'recepcionista')
    )
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário aprovado com sucesso',
    'user_id', p_user_id,
    'cliente_id', v_cliente_final_id,
    'role', COALESCE(p_role, 'recepcionista')
  );
END;
$$;

-- Create get_user_roles function
CREATE OR REPLACE FUNCTION public.get_user_roles(p_user_id uuid)
RETURNS TABLE(role app_role, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ur.role, ur.created_at
  FROM public.user_roles ur
  WHERE ur.user_id = p_user_id;
END;
$$;

-- Create atualizar_role_usuario function
CREATE OR REPLACE FUNCTION public.atualizar_role_usuario(
  p_admin_user_id uuid,
  p_target_user_id uuid,
  p_new_role text,
  p_action text DEFAULT 'add' -- 'add' or 'remove'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se é admin
  IF NOT public.has_role(p_admin_user_id, 'admin') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem alterar roles'
    );
  END IF;

  -- Verificar se target user existe
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_target_user_id) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;

  IF p_action = 'add' THEN
    INSERT INTO public.user_roles (user_id, role, created_by)
    VALUES (p_target_user_id, p_new_role::app_role, p_admin_user_id)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RETURN json_build_object(
      'success', true,
      'message', 'Role adicionada com sucesso'
    );
  ELSIF p_action = 'remove' THEN
    DELETE FROM public.user_roles
    WHERE user_id = p_target_user_id AND role = p_new_role::app_role;
    
    RETURN json_build_object(
      'success', true,
      'message', 'Role removida com sucesso'
    );
  ELSE
    RETURN json_build_object(
      'success', false,
      'error', 'Ação inválida. Use "add" ou "remove"'
    );
  END IF;
END;
$$;