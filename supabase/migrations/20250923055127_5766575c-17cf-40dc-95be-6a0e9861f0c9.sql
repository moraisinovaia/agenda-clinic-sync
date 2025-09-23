-- Função para atualizar cliente_id de usuário (apenas admin)
CREATE OR REPLACE FUNCTION public.atualizar_cliente_usuario(
  p_user_email text,
  p_novo_cliente_id uuid,
  p_admin_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_profile_id uuid;
  v_antigo_cliente_nome text;
  v_novo_cliente_nome text;
BEGIN
  -- Verificar se é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = COALESCE(p_admin_id, auth.uid())
    AND role = 'admin' 
    AND status = 'aprovado'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Acesso negado: apenas administradores podem alterar cliente de usuários'
    );
  END IF;

  -- Buscar nomes dos clientes para log
  SELECT c1.nome, c2.nome INTO v_antigo_cliente_nome, v_novo_cliente_nome
  FROM public.profiles p
  LEFT JOIN public.clientes c1 ON p.cliente_id = c1.id
  CROSS JOIN public.clientes c2
  WHERE p.email = p_user_email 
  AND c2.id = p_novo_cliente_id;
  
  -- Atualizar o cliente_id do usuário
  UPDATE public.profiles 
  SET cliente_id = p_novo_cliente_id,
      updated_at = now()
  WHERE email = p_user_email
  RETURNING id INTO v_profile_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;

  -- Log da alteração
  INSERT INTO public.system_logs (
    timestamp, level, message, context, user_id
  ) VALUES (
    now(), 'info', 
    FORMAT('Cliente alterado para usuário %s: %s → %s', 
           p_user_email, 
           COALESCE(v_antigo_cliente_nome, 'null'), 
           v_novo_cliente_nome),
    'USER_CLIENT_UPDATE',
    COALESCE(p_admin_id, auth.uid())
  );
  
  RETURN json_build_object(
    'success', true,
    'message', FORMAT('Cliente atualizado: %s → %s', 
                     COALESCE(v_antigo_cliente_nome, 'null'), 
                     v_novo_cliente_nome),
    'profile_id', v_profile_id,
    'antigo_cliente', v_antigo_cliente_nome,
    'novo_cliente', v_novo_cliente_nome
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Erro interno: ' || SQLERRM
    );
END;
$$;