-- Fix the aprovar_usuario function to handle user_id vs profile_id correctly
CREATE OR REPLACE FUNCTION public.aprovar_usuario(p_user_id uuid, p_aprovador_id uuid, p_cliente_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_aprovador_profile_id uuid;
BEGIN
  -- Verificar se o aprovador é admin e obter seu profile_id
  SELECT id INTO v_aprovador_profile_id
  FROM public.profiles 
  WHERE user_id = p_aprovador_id 
  AND role = 'admin' 
  AND status = 'aprovado';
  
  IF v_aprovador_profile_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem aprovar usuários'
    );
  END IF;

  -- Verificar se o cliente existe
  IF NOT EXISTS (
    SELECT 1 FROM public.clientes 
    WHERE id = p_cliente_id AND ativo = true
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cliente não encontrado ou inativo'
    );
  END IF;

  -- Aprovar o usuário e vincular ao cliente usando o profile_id do aprovador
  UPDATE public.profiles 
  SET 
    status = 'aprovado',
    cliente_id = p_cliente_id,
    aprovado_por = v_aprovador_profile_id,
    data_aprovacao = now()
  WHERE user_id = p_user_id AND status = 'pendente';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado ou já foi processado'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário aprovado e vinculado ao cliente'
  );
END;
$function$;