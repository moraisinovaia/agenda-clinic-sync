-- Criar função para excluir usuários
CREATE OR REPLACE FUNCTION public.excluir_usuario(p_user_id uuid, p_admin_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verificar se quem está excluindo é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_admin_id 
    AND role = 'admin' 
    AND status = 'aprovado'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem excluir usuários'
    );
  END IF;

  -- Verificar se o usuário existe
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_user_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;

  -- Prevenir auto-exclusão
  IF p_user_id = p_admin_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Não é possível excluir seu próprio usuário'
    );
  END IF;

  -- Excluir o usuário
  DELETE FROM public.profiles 
  WHERE id = p_user_id;

  -- Log da exclusão
  INSERT INTO public.system_logs (
    timestamp, level, message, context, data
  ) VALUES (
    now(), 'info', 
    'Usuário excluído pelo administrador',
    'USER_DELETION',
    jsonb_build_object(
      'profile_id_excluido', p_user_id,
      'excluido_por_profile_id', p_admin_id
    )
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário excluído com sucesso'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Erro interno: ' || SQLERRM
    );
END;
$function$