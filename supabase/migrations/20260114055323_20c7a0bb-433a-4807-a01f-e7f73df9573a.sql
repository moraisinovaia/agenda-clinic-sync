
-- Migration: Corrigir funções SECURITY DEFINER críticas - Parte 1
-- Adiciona validações de permissão em funções de teste/criação

-- 1. Corrigir create_test_user_profile - adicionar validação de admin
CREATE OR REPLACE FUNCTION public.create_test_user_profile(
  p_user_id uuid,
  p_nome text,
  p_email text,
  p_username text,
  p_cliente_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_is_admin boolean;
BEGIN
  -- Obter ID do chamador (pode ser null se chamado de service role)
  v_caller_id := auth.uid();
  
  -- Se houver um chamador autenticado, verificar se é admin
  -- Se não houver (service role), permitir (chamado de edge function)
  IF v_caller_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_caller_id AND role = 'admin'
    ) INTO v_is_admin;
    
    IF NOT v_is_admin THEN
      RETURN jsonb_build_object('success', false, 'error', 'Acesso negado: apenas administradores podem criar usuários de teste');
    END IF;
  END IF;

  -- Verificar se profile já existe
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile já existe para este usuário');
  END IF;

  -- Verificar se cliente existe
  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado');
  END IF;

  -- Criar profile com status aprovado
  INSERT INTO public.profiles (user_id, nome, email, username, cliente_id, status, created_at, updated_at)
  VALUES (p_user_id, p_nome, p_email, p_username, p_cliente_id, 'aprovado', now(), now());
  
  RETURN jsonb_build_object('success', true, 'message', 'Profile de teste criado com sucesso');
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 2. Corrigir atualizar_dados_paciente - adicionar validação de permissão e cliente
CREATE OR REPLACE FUNCTION public.atualizar_dados_paciente(
  p_paciente_id uuid,
  p_nome text DEFAULT NULL,
  p_celular text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_data_nascimento date DEFAULT NULL,
  p_cpf text DEFAULT NULL,
  p_convenio text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_cliente_id uuid;
  v_paciente_cliente_id uuid;
  v_is_admin boolean;
  v_has_access boolean;
BEGIN
  v_caller_id := auth.uid();
  
  -- Verificar autenticação
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;
  
  -- Verificar se é admin global
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller_id AND role = 'admin'
  ) INTO v_is_admin;
  
  -- Se não for admin, verificar acesso ao cliente do paciente
  IF NOT v_is_admin THEN
    -- Obter cliente_id do chamador
    SELECT cliente_id INTO v_caller_cliente_id
    FROM public.profiles
    WHERE user_id = v_caller_id;
    
    -- Obter cliente_id do paciente
    SELECT cliente_id INTO v_paciente_cliente_id
    FROM public.pacientes
    WHERE id = p_paciente_id;
    
    IF v_paciente_cliente_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Paciente não encontrado');
    END IF;
    
    IF v_caller_cliente_id IS NULL OR v_caller_cliente_id != v_paciente_cliente_id THEN
      RETURN json_build_object('success', false, 'error', 'Acesso negado: você não tem permissão para editar este paciente');
    END IF;
  END IF;
  
  -- Atualizar paciente
  UPDATE public.pacientes
  SET
    nome = COALESCE(p_nome, nome),
    celular = COALESCE(p_celular, celular),
    email = COALESCE(p_email, email),
    data_nascimento = COALESCE(p_data_nascimento, data_nascimento),
    cpf = COALESCE(p_cpf, cpf),
    convenio = COALESCE(p_convenio, convenio),
    updated_at = now()
  WHERE id = p_paciente_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Paciente não encontrado');
  END IF;
  
  RETURN json_build_object('success', true, 'message', 'Dados do paciente atualizados com sucesso');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erro interno ao atualizar paciente');
END;
$$;

-- 3. Corrigir cancelar_agendamento_soft - adicionar validação de cliente
CREATE OR REPLACE FUNCTION public.cancelar_agendamento_soft(
  p_agendamento_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_cliente_id uuid;
  v_agendamento_cliente_id uuid;
  v_is_admin boolean;
BEGIN
  v_caller_id := auth.uid();
  
  -- Verificar autenticação
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;
  
  -- Verificar se é admin global
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller_id AND role = 'admin'
  ) INTO v_is_admin;
  
  -- Se não for admin, verificar acesso ao cliente do agendamento
  IF NOT v_is_admin THEN
    SELECT cliente_id INTO v_caller_cliente_id
    FROM public.profiles
    WHERE user_id = v_caller_id;
    
    SELECT cliente_id INTO v_agendamento_cliente_id
    FROM public.agendamentos
    WHERE id = p_agendamento_id;
    
    IF v_agendamento_cliente_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;
    
    IF v_caller_cliente_id IS NULL OR v_caller_cliente_id != v_agendamento_cliente_id THEN
      RETURN json_build_object('success', false, 'error', 'Acesso negado: você não tem permissão para cancelar este agendamento');
    END IF;
  END IF;
  
  -- Cancelar agendamento (soft delete)
  UPDATE public.agendamentos
  SET
    status = 'cancelado',
    motivo_cancelamento = COALESCE(p_motivo, 'Cancelado pelo usuário'),
    updated_at = now()
  WHERE id = p_agendamento_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;
  
  RETURN json_build_object('success', true, 'message', 'Agendamento cancelado com sucesso');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erro interno ao cancelar agendamento');
END;
$$;

-- 4. Corrigir confirmar_agendamento - adicionar validação de cliente
CREATE OR REPLACE FUNCTION public.confirmar_agendamento(p_agendamento_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_cliente_id uuid;
  v_agendamento_cliente_id uuid;
  v_is_admin boolean;
BEGIN
  v_caller_id := auth.uid();
  
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    SELECT cliente_id INTO v_caller_cliente_id
    FROM public.profiles WHERE user_id = v_caller_id;
    
    SELECT cliente_id INTO v_agendamento_cliente_id
    FROM public.agendamentos WHERE id = p_agendamento_id;
    
    IF v_agendamento_cliente_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;
    
    IF v_caller_cliente_id IS NULL OR v_caller_cliente_id != v_agendamento_cliente_id THEN
      RETURN json_build_object('success', false, 'error', 'Acesso negado');
    END IF;
  END IF;
  
  UPDATE public.agendamentos
  SET confirmado = true, updated_at = now()
  WHERE id = p_agendamento_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;
  
  RETURN json_build_object('success', true, 'message', 'Agendamento confirmado');
END;
$$;

-- 5. Corrigir desconfirmar_agendamento - adicionar validação de cliente
CREATE OR REPLACE FUNCTION public.desconfirmar_agendamento(p_agendamento_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_cliente_id uuid;
  v_agendamento_cliente_id uuid;
  v_is_admin boolean;
BEGIN
  v_caller_id := auth.uid();
  
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    SELECT cliente_id INTO v_caller_cliente_id
    FROM public.profiles WHERE user_id = v_caller_id;
    
    SELECT cliente_id INTO v_agendamento_cliente_id
    FROM public.agendamentos WHERE id = p_agendamento_id;
    
    IF v_agendamento_cliente_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;
    
    IF v_caller_cliente_id IS NULL OR v_caller_cliente_id != v_agendamento_cliente_id THEN
      RETURN json_build_object('success', false, 'error', 'Acesso negado');
    END IF;
  END IF;
  
  UPDATE public.agendamentos
  SET confirmado = false, updated_at = now()
  WHERE id = p_agendamento_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;
  
  RETURN json_build_object('success', true, 'message', 'Confirmação removida');
END;
$$;

-- 6. Corrigir excluir_agendamento_soft - adicionar validação de cliente
CREATE OR REPLACE FUNCTION public.excluir_agendamento_soft(p_agendamento_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_cliente_id uuid;
  v_agendamento_cliente_id uuid;
  v_is_admin boolean;
BEGIN
  v_caller_id := auth.uid();
  
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    SELECT cliente_id INTO v_caller_cliente_id
    FROM public.profiles WHERE user_id = v_caller_id;
    
    SELECT cliente_id INTO v_agendamento_cliente_id
    FROM public.agendamentos WHERE id = p_agendamento_id;
    
    IF v_agendamento_cliente_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;
    
    IF v_caller_cliente_id IS NULL OR v_caller_cliente_id != v_agendamento_cliente_id THEN
      RETURN json_build_object('success', false, 'error', 'Acesso negado');
    END IF;
  END IF;
  
  UPDATE public.agendamentos
  SET deleted = true, updated_at = now()
  WHERE id = p_agendamento_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;
  
  RETURN json_build_object('success', true, 'message', 'Agendamento excluído');
END;
$$;
