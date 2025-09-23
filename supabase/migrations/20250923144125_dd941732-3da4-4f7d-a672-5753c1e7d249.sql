-- Melhorar a função criar_usuario_teste_ipado para aprovar automaticamente
CREATE OR REPLACE FUNCTION public.criar_usuario_teste_ipado()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_cliente_ipado_id uuid;
  v_user_id uuid;
  v_existing_profile_id uuid;
  v_credentials jsonb;
BEGIN
  -- Buscar cliente IPADO
  SELECT id INTO v_cliente_ipado_id
  FROM public.clientes
  WHERE nome = 'IPADO'
  LIMIT 1;

  -- Se não existir, criar cliente IPADO
  IF v_cliente_ipado_id IS NULL THEN
    INSERT INTO public.clientes (nome, ativo, configuracoes)
    VALUES ('IPADO', true, '{"tipo": "clinica", "sistema_origem": "manual"}'::jsonb)
    RETURNING id INTO v_cliente_ipado_id;
  END IF;

  -- Verificar se já existe usuário com esse email
  SELECT au.id INTO v_user_id
  FROM auth.users au
  WHERE au.email = 'teste@ipado.com';

  -- Se o usuário já existe, verificar se tem perfil
  IF v_user_id IS NOT NULL THEN
    SELECT id INTO v_existing_profile_id
    FROM public.profiles
    WHERE user_id = v_user_id;

    -- Se já tem perfil, só atualizar para aprovado e vinculado ao IPADO
    IF v_existing_profile_id IS NOT NULL THEN
      UPDATE public.profiles
      SET status = 'aprovado',
          cliente_id = v_cliente_ipado_id,
          role = 'recepcionista',
          data_aprovacao = now(),
          updated_at = now()
      WHERE user_id = v_user_id;

      -- Confirmar email se necessário
      UPDATE auth.users
      SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
          updated_at = now()
      WHERE id = v_user_id;

      RETURN json_build_object(
        'success', true,
        'message', 'Usuário teste IPADO atualizado e aprovado',
        'credentials', json_build_object(
          'email', 'teste@ipado.com',
          'password', 'senha123456'
        ),
        'user_updated', true
      );
    ELSE
      -- Criar perfil para usuário órfão
      INSERT INTO public.profiles (
        user_id, nome, email, role, status, ativo, cliente_id, 
        data_aprovacao, created_at, updated_at
      ) VALUES (
        v_user_id, 'Usuário Teste IPADO', 'teste@ipado.com', 'recepcionista', 
        'aprovado', true, v_cliente_ipado_id, now(), now(), now()
      );

      -- Confirmar email
      UPDATE auth.users
      SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
          updated_at = now()
      WHERE id = v_user_id;

      RETURN json_build_object(
        'success', true,
        'message', 'Perfil criado para usuário teste IPADO existente',
        'credentials', json_build_object(
          'email', 'teste@ipado.com',
          'password', 'senha123456'
        ),
        'profile_created', true
      );
    END IF;
  END IF;

  -- Se chegou aqui, não existe usuário, então precisa criar
  RETURN json_build_object(
    'success', false,
    'error', 'Usuário teste deve ser criado via auth.users primeiro',
    'message', 'Execute o signup manual para teste@ipado.com primeiro'
  );

END;
$function$;