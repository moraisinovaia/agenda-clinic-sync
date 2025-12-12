-- Função para criar usuário teste - bypass RLS
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
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verificar se profile já existe
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Profile já existe para este usuário'
    );
  END IF;

  -- Inserir profile
  INSERT INTO public.profiles (
    user_id,
    nome,
    email,
    username,
    status,
    cliente_id,
    ativo,
    cargo,
    data_aprovacao,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_nome,
    p_email,
    p_username,
    'aprovado',
    p_cliente_id,
    true,
    'recepcionista',
    now(),
    now(),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Profile criado com sucesso'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_test_user_profile TO service_role;