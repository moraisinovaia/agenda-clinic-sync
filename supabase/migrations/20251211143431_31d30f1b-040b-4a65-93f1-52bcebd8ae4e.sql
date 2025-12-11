-- =====================================================
-- MIGRATION: Multi-Clinic Support (Safe Implementation)
-- Adds cliente_id parameter to aprovar_usuario with fallback to IPADO
-- Adds RPC function to list clients for admin panel
-- =====================================================

-- 1. Update aprovar_usuario to accept optional cliente_id with IPADO fallback
CREATE OR REPLACE FUNCTION public.aprovar_usuario(
  p_user_id uuid,
  p_aprovador_user_id uuid,
  p_cliente_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_cliente_id uuid;
  v_ipado_cliente_id uuid;
BEGIN
  -- Log início da operação
  RAISE NOTICE 'aprovar_usuario: Iniciando para user_id=%, aprovador=%, cliente_id=%', 
    p_user_id, p_aprovador_user_id, p_cliente_id;

  -- Buscar ID do cliente IPADO como fallback
  SELECT id INTO v_ipado_cliente_id
  FROM public.clientes
  WHERE nome = 'IPADO'
  LIMIT 1;

  -- Se não encontrou IPADO, tentar primeiro cliente ativo
  IF v_ipado_cliente_id IS NULL THEN
    SELECT id INTO v_ipado_cliente_id
    FROM public.clientes
    WHERE ativo = true
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Determinar qual cliente_id usar (parâmetro ou fallback)
  v_cliente_id := COALESCE(p_cliente_id, v_ipado_cliente_id);

  IF v_cliente_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Nenhum cliente disponível no sistema'
    );
  END IF;

  -- Verificar se o usuário existe em profiles
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF v_profile_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Perfil do usuário não encontrado'
    );
  END IF;

  -- Atualizar o perfil do usuário
  UPDATE public.profiles
  SET 
    status = 'aprovado',
    ativo = true,
    cliente_id = v_cliente_id,
    aprovado_por = (SELECT id FROM public.profiles WHERE user_id = p_aprovador_user_id LIMIT 1),
    data_aprovacao = now(),
    updated_at = now()
  WHERE id = v_profile_id;

  -- Log da operação bem-sucedida
  INSERT INTO public.system_logs (level, message, context, timestamp, data)
  VALUES (
    'info',
    'Usuário aprovado com sucesso',
    'aprovar_usuario',
    now(),
    json_build_object(
      'user_id', p_user_id,
      'aprovador_user_id', p_aprovador_user_id,
      'cliente_id', v_cliente_id,
      'profile_id', v_profile_id
    )
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário aprovado com sucesso',
    'profile_id', v_profile_id,
    'cliente_id', v_cliente_id
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro
    INSERT INTO public.system_logs (level, message, context, timestamp, data)
    VALUES (
      'error',
      'Erro ao aprovar usuário: ' || SQLERRM,
      'aprovar_usuario',
      now(),
      json_build_object(
        'user_id', p_user_id,
        'error', SQLERRM
      )
    );
    
    RETURN json_build_object(
      'success', false,
      'error', 'Erro ao aprovar usuário: ' || SQLERRM
    );
END;
$$;

-- 2. Create function to list active clients (for admin dropdown)
CREATE OR REPLACE FUNCTION public.get_clientes_ativos()
RETURNS TABLE (
  id uuid,
  nome text,
  ativo boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.nome, c.ativo, c.created_at
  FROM public.clientes c
  WHERE c.ativo = true
  ORDER BY c.nome ASC;
$$;

-- 3. Create function to create a new client (super admin only)
CREATE OR REPLACE FUNCTION public.criar_cliente(
  p_nome text,
  p_admin_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
  v_is_admin boolean;
BEGIN
  -- Verificar se o usuário é admin (se fornecido)
  IF p_admin_user_id IS NOT NULL THEN
    SELECT public.has_role(p_admin_user_id, 'admin') INTO v_is_admin;
    IF NOT v_is_admin THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Apenas administradores podem criar clientes'
      );
    END IF;
  END IF;

  -- Verificar se já existe cliente com este nome
  IF EXISTS (SELECT 1 FROM public.clientes WHERE nome = p_nome) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Já existe um cliente com este nome'
    );
  END IF;

  -- Criar o cliente
  INSERT INTO public.clientes (nome, ativo, configuracoes)
  VALUES (p_nome, true, '{"tipo": "clinica"}'::jsonb)
  RETURNING id INTO v_cliente_id;

  -- Log da operação
  INSERT INTO public.system_logs (level, message, context, timestamp, data)
  VALUES (
    'info',
    'Novo cliente criado: ' || p_nome,
    'criar_cliente',
    now(),
    json_build_object(
      'cliente_id', v_cliente_id,
      'nome', p_nome,
      'admin_user_id', p_admin_user_id
    )
  );

  RETURN json_build_object(
    'success', true,
    'cliente_id', v_cliente_id,
    'message', 'Cliente criado com sucesso'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Erro ao criar cliente: ' || SQLERRM
    );
END;
$$;

-- 4. Create function to update client status
CREATE OR REPLACE FUNCTION public.atualizar_cliente(
  p_cliente_id uuid,
  p_nome text DEFAULT NULL,
  p_ativo boolean DEFAULT NULL,
  p_admin_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Verificar se o usuário é admin
  IF p_admin_user_id IS NOT NULL THEN
    SELECT public.has_role(p_admin_user_id, 'admin') INTO v_is_admin;
    IF NOT v_is_admin THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Apenas administradores podem atualizar clientes'
      );
    END IF;
  END IF;

  -- Verificar se o cliente existe
  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cliente não encontrado'
    );
  END IF;

  -- Atualizar o cliente
  UPDATE public.clientes
  SET 
    nome = COALESCE(p_nome, nome),
    ativo = COALESCE(p_ativo, ativo),
    updated_at = now()
  WHERE id = p_cliente_id;

  -- Log da operação
  INSERT INTO public.system_logs (level, message, context, timestamp, data)
  VALUES (
    'info',
    'Cliente atualizado',
    'atualizar_cliente',
    now(),
    json_build_object(
      'cliente_id', p_cliente_id,
      'nome', p_nome,
      'ativo', p_ativo,
      'admin_user_id', p_admin_user_id
    )
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Cliente atualizado com sucesso'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Erro ao atualizar cliente: ' || SQLERRM
    );
END;
$$;

-- 5. Create function to get client statistics
CREATE OR REPLACE FUNCTION public.get_client_stats(p_cliente_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_medicos', (SELECT COUNT(*) FROM public.medicos WHERE cliente_id = p_cliente_id AND ativo = true),
    'total_pacientes', (SELECT COUNT(*) FROM public.pacientes WHERE cliente_id = p_cliente_id),
    'total_agendamentos', (SELECT COUNT(*) FROM public.agendamentos WHERE cliente_id = p_cliente_id),
    'total_usuarios', (SELECT COUNT(*) FROM public.profiles WHERE cliente_id = p_cliente_id AND status = 'aprovado'),
    'agendamentos_hoje', (
      SELECT COUNT(*) 
      FROM public.agendamentos 
      WHERE cliente_id = p_cliente_id 
        AND data_agendamento = CURRENT_DATE
        AND status IN ('agendado', 'confirmado')
    )
  );
$$;