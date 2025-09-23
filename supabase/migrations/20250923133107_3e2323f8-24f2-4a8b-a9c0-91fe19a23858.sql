-- Corrigir função aprovar_usuario para aceitar profile_id ou user_id como aprovador
CREATE OR REPLACE FUNCTION public.aprovar_usuario(
  p_user_id uuid, 
  p_aprovador_id uuid, 
  p_cliente_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aprovador_user_id uuid;
BEGIN
  -- Determinar se p_aprovador_id é um user_id ou profile_id
  -- Primeiro, tentar como user_id direto
  SELECT user_id INTO v_aprovador_user_id
  FROM public.profiles 
  WHERE user_id = p_aprovador_id 
  AND role = 'admin' 
  AND status = 'aprovado'
  LIMIT 1;
  
  -- Se não encontrou, tentar como profile_id
  IF v_aprovador_user_id IS NULL THEN
    SELECT user_id INTO v_aprovador_user_id
    FROM public.profiles 
    WHERE id = p_aprovador_id 
    AND role = 'admin' 
    AND status = 'aprovado'
    LIMIT 1;
  END IF;
  
  -- Verificar se encontrou um admin válido
  IF v_aprovador_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem aprovar usuários'
    );
  END IF;

  -- Se cliente_id não foi fornecido, buscar cliente IPADO como padrão
  IF p_cliente_id IS NULL THEN
    SELECT id INTO p_cliente_id 
    FROM public.clientes 
    WHERE nome = 'IPADO' 
    LIMIT 1;
    
    IF p_cliente_id IS NULL THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Cliente IPADO não encontrado'
      );
    END IF;
  END IF;

  -- Aprovar o usuário
  UPDATE public.profiles 
  SET 
    status = 'aprovado',
    cliente_id = p_cliente_id,
    aprovado_por = v_aprovador_user_id,  -- Usar o user_id do aprovador
    data_aprovacao = now()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário aprovado com sucesso'
  );
END;
$$;