-- Dropar e recriar a função aprovar_usuario para corrigir o constraint de aprovado_por
DROP FUNCTION IF EXISTS public.aprovar_usuario(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.aprovar_usuario(p_user_id uuid, p_aprovador_id uuid, p_cliente_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_aprovador_profile_id uuid;
BEGIN
  -- Buscar o profile.id do aprovador (não o user_id)
  SELECT id INTO v_aprovador_profile_id
  FROM public.profiles 
  WHERE user_id = p_aprovador_id 
  AND role = 'admin' 
  AND status = 'aprovado'
  LIMIT 1;

  -- Verificar se o aprovador é admin
  IF v_aprovador_profile_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem aprovar usuários'
    );
  END IF;

  -- Verificar se o cliente existe
  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cliente não encontrado'
    );
  END IF;

  -- Aprovar o usuário usando profile.id do aprovador
  UPDATE public.profiles 
  SET 
    status = 'aprovado',
    cliente_id = p_cliente_id,
    aprovado_por = v_aprovador_profile_id,  -- Usar profile.id, não user_id
    data_aprovacao = now(),
    updated_at = now()
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
$function$;