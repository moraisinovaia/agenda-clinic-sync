-- Verificar e corrigir o trigger handle_new_user para capturar o username corretamente
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
  v_username text;
  v_nome text;
BEGIN
  -- Buscar cliente_id padrão (INOVAIA)
  SELECT id INTO v_cliente_id 
  FROM public.clientes 
  WHERE nome = 'INOVAIA' 
  LIMIT 1;
  
  -- Se não existe cliente INOVAIA, criar
  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (nome, ativo, configuracoes)
    VALUES ('INOVAIA', true, '{"tipo": "clinica", "sistema_origem": "automatic"}'::jsonb)
    RETURNING id INTO v_cliente_id;
  END IF;

  -- Extrair username dos metadados (tentando várias formas)
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->'username'::text,
    split_part(NEW.email, '@', 1)
  );
  
  -- Extrair nome dos metadados
  v_nome := COALESCE(
    NEW.raw_user_meta_data->>'nome',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  
  -- Log para debug
  INSERT INTO public.system_logs (
    timestamp, level, message, context, data
  ) VALUES (
    now(), 'info',
    '[TRIGGER] handle_new_user executado',
    'USER_CREATION',
    jsonb_build_object(
      'user_id', NEW.id,
      'email', NEW.email,
      'raw_meta_data', NEW.raw_user_meta_data,
      'extracted_username', v_username,
      'extracted_nome', v_nome
    )
  );
  
  -- Inserir perfil com cargo padrão
  INSERT INTO public.profiles (
    user_id,
    nome,
    email,
    username,
    cliente_id,
    status,
    cargo,
    ativo
  ) VALUES (
    NEW.id,
    v_nome,
    NEW.email,
    v_username,
    v_cliente_id,
    'pendente',
    'recepcionista',
    true
  );
  
  RETURN NEW;
END;
$$;

-- Recriar o trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Log da correção
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info',
  '[FIX] Trigger handle_new_user atualizado com melhor extração de username',
  'TRIGGER_USERNAME_FIX',
  jsonb_build_object(
    'changes', ARRAY[
      'Melhorado extração do username dos metadados',
      'Adicionado log detalhado para debug',
      'Tentativas múltiplas de extração'
    ]
  )
);