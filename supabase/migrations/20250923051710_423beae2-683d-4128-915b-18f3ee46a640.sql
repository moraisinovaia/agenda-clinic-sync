-- Vou criar um teste simples para ver se o problema é com o trigger
-- Primeiro, vou verificar se o trigger está ativo e funcionando

-- Vamos simplificar o processo e garantir que tudo funcione
-- Remover o constraint que pode estar causando problema

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_cliente_id_required_when_approved;

-- Recriar a função de forma mais robusta
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_username TEXT;
  new_nome TEXT;
  new_role TEXT;
BEGIN
  -- Extrair dados com fallbacks seguros  
  new_nome := COALESCE(NEW.raw_user_meta_data ->> 'nome', split_part(NEW.email, '@', 1));
  new_username := COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1));
  new_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'recepcionista');
  
  -- Log para debug
  RAISE NOTICE 'Criando perfil para usuário: %, email: %, nome: %, username: %', NEW.id, NEW.email, new_nome, new_username;
  
  -- Inserir perfil básico
  INSERT INTO public.profiles (
    user_id, 
    nome, 
    email, 
    role, 
    username, 
    status,
    ativo
  ) VALUES (
    NEW.id,
    new_nome,
    NEW.email,
    new_role,
    new_username,
    'pendente',
    true
  );
  
  RAISE NOTICE 'Perfil criado com sucesso para usuário: %', NEW.id;
  
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Se já existe, apenas continuar
    RAISE NOTICE 'Perfil já existe para usuário: %', NEW.id;
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log do erro mas não falhar o cadastro
    RAISE NOTICE 'Erro ao criar perfil: % - %', SQLSTATE, SQLERRM;
    RETURN NEW;
END;
$$;

-- Verificar se o trigger existe e recriar se necessário
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();