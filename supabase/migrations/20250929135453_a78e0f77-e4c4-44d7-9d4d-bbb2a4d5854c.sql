-- Correção do Sistema de Aprovação de Usuários
-- Criar função que cria automaticamente perfil pendente quando usuário se registra

-- 1. Criar ou substituir a função handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_cliente_ipado_id UUID;
BEGIN
  -- Buscar ID do cliente IPADO (padrão)
  SELECT id INTO v_cliente_ipado_id 
  FROM public.clientes 
  WHERE nome = 'IPADO' 
  LIMIT 1;
  
  -- Se não existe cliente IPADO, criar
  IF v_cliente_ipado_id IS NULL THEN
    INSERT INTO public.clientes (nome, ativo, configuracoes)
    VALUES ('IPADO', true, '{"tipo": "clinica", "sistema_origem": "automatic"}'::jsonb)
    RETURNING id INTO v_cliente_ipado_id;
  END IF;

  -- Criar perfil pendente para o novo usuário
  INSERT INTO public.profiles (
    user_id,
    nome,
    email,
    role,
    status,
    ativo,
    cliente_id,
    username,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    NEW.email,
    'recepcionista',
    'pendente',
    true,
    v_cliente_ipado_id,
    NEW.raw_user_meta_data->>'username',
    now(),
    now()
  );

  -- Log da criação do perfil
  INSERT INTO public.system_logs (
    timestamp, level, message, context, user_id, data
  ) VALUES (
    now(), 'info',
    'Novo perfil criado automaticamente via trigger',
    'USER_PROFILE_CREATION',
    NEW.id,
    jsonb_build_object(
      'user_id', NEW.id,
      'email', NEW.email,
      'status', 'pendente',
      'trigger', 'on_auth_user_created'
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro
    INSERT INTO public.system_logs (
      timestamp, level, message, context, user_id, data
    ) VALUES (
      now(), 'error',
      'Erro ao criar perfil automaticamente: ' || SQLERRM,
      'USER_PROFILE_CREATION_ERROR',
      NEW.id,
      jsonb_build_object(
        'user_id', NEW.id,
        'email', NEW.email,
        'error', SQLERRM
      )
    );
    
    -- Não bloquear o registro mesmo se der erro
    RETURN NEW;
END;
$$;

-- 2. Criar o trigger na tabela auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Corrigir usuários órfãos (que existem em auth.users mas não têm perfil)
DO $$
DECLARE
  v_user_record RECORD;
  v_cliente_ipado_id UUID;
  v_orphan_count INTEGER := 0;
BEGIN
  -- Buscar cliente IPADO
  SELECT id INTO v_cliente_ipado_id 
  FROM public.clientes 
  WHERE nome = 'IPADO' 
  LIMIT 1;
  
  -- Se não existe, criar
  IF v_cliente_ipado_id IS NULL THEN
    INSERT INTO public.clientes (nome, ativo, configuracoes)
    VALUES ('IPADO', true, '{"tipo": "clinica", "sistema_origem": "automatic"}'::jsonb)
    RETURNING id INTO v_cliente_ipado_id;
  END IF;

  -- Buscar usuários órfãos e criar perfis para eles
  FOR v_user_record IN 
    SELECT u.id, u.email, u.raw_user_meta_data, u.created_at
    FROM auth.users u
    LEFT JOIN public.profiles p ON u.id = p.user_id
    WHERE p.user_id IS NULL
      AND u.email IS NOT NULL
  LOOP
    BEGIN
      INSERT INTO public.profiles (
        user_id,
        nome,
        email,
        role,
        status,
        ativo,
        cliente_id,
        username,
        created_at,
        updated_at
      ) VALUES (
        v_user_record.id,
        COALESCE(v_user_record.raw_user_meta_data->>'nome', v_user_record.raw_user_meta_data->>'full_name', 'Usuário'),
        v_user_record.email,
        'recepcionista',
        'pendente',
        true,
        v_cliente_ipado_id,
        v_user_record.raw_user_meta_data->>'username',
        v_user_record.created_at,
        now()
      );
      
      v_orphan_count := v_orphan_count + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Log erro mas continua processando outros usuários
        INSERT INTO public.system_logs (
          timestamp, level, message, context, data
        ) VALUES (
          now(), 'warning',
          'Erro ao criar perfil para usuário órfão: ' || SQLERRM,
          'ORPHAN_USER_PROFILE_CREATION',
          jsonb_build_object(
            'user_id', v_user_record.id,
            'email', v_user_record.email,
            'error', SQLERRM
          )
        );
    END;
  END LOOP;

  -- Log do resultado da correção
  INSERT INTO public.system_logs (
    timestamp, level, message, context, data
  ) VALUES (
    now(), 'info',
    FORMAT('Sistema de aprovação corrigido - %s usuários órfãos processados', v_orphan_count),
    'APPROVAL_SYSTEM_CORRECTION',
    jsonb_build_object(
      'orphan_users_processed', v_orphan_count,
      'trigger_recreated', true,
      'cliente_ipado_id', v_cliente_ipado_id
    )
  );
END;
$$;