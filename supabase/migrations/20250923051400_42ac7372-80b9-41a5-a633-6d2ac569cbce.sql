-- Corrigir políticas RLS para permitir verificação de username e criação de perfis pendentes

-- Primeiro, criar uma política temporária para permitir leitura de usernames para verificação de duplicatas
DROP POLICY IF EXISTS "Allow username check for signup" ON public.profiles;
CREATE POLICY "Allow username check for signup" 
ON public.profiles 
FOR SELECT 
USING (true);  -- Permite verificar usernames existentes para evitar duplicatas

-- Permitir que o trigger insira perfis sem cliente_id (status pendente)
DROP POLICY IF EXISTS "Allow profile creation via trigger" ON public.profiles;
CREATE POLICY "Allow profile creation via trigger" 
ON public.profiles 
FOR INSERT 
WITH CHECK (status = 'pendente');  -- Apenas perfis pendentes podem ser criados sem autenticação

-- Corrigir o constraint para permitir cliente_id nulo apenas para status pendente
-- Primeiro, vamos verificar se o constraint existe e removê-lo se necessário
DO $$
BEGIN
    -- Adicionar um check constraint para garantir que cliente_id é obrigatório para usuários aprovados
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_cliente_id_required_when_approved' 
        AND table_name = 'profiles'
    ) THEN
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_cliente_id_required_when_approved 
        CHECK (
            (status = 'pendente' AND cliente_id IS NULL) OR 
            (status != 'pendente' AND cliente_id IS NOT NULL)
        );
    END IF;
END $$;

-- Garantir que a função handle_new_user funcione corretamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Inserir perfil pendente sem cliente_id (será definido na aprovação)
  INSERT INTO public.profiles (user_id, nome, email, role, username, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'recepcionista'),
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    'pendente'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;