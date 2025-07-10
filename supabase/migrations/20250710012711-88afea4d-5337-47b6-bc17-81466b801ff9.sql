-- Adicionar coluna username na tabela profiles
ALTER TABLE public.profiles ADD COLUMN username VARCHAR(50) UNIQUE;

-- Criar índice para otimizar consultas por username
CREATE INDEX idx_profiles_username ON public.profiles(username);

-- Atualizar a função handle_new_user para incluir username se fornecido
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email, role, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'recepcionista'),
    NEW.raw_user_meta_data ->> 'username'
  );
  RETURN NEW;
END;
$$;