-- Criar tabela de perfis de usuários (recepcionistas)
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'recepcionista',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS na tabela profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
CREATE POLICY "Usuários podem ver todos os perfis" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Usuários podem atualizar seu próprio perfil" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

-- Adicionar coluna para rastrear quem criou o agendamento
ALTER TABLE public.agendamentos 
ADD COLUMN criado_por_user_id UUID REFERENCES auth.users(id);

-- Atualizar a coluna criado_por para referenciar o nome do usuário
ALTER TABLE public.agendamentos 
ALTER COLUMN criado_por TYPE TEXT;

-- Habilitar RLS na tabela agendamentos
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para agendamentos
CREATE POLICY "Usuários autenticados podem ver agendamentos" 
ON public.agendamentos 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Usuários autenticados podem criar agendamentos" 
ON public.agendamentos 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar agendamentos" 
ON public.agendamentos 
FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Usuários autenticados podem deletar agendamentos" 
ON public.agendamentos 
FOR DELETE 
TO authenticated 
USING (true);

-- Habilitar RLS na tabela pacientes
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para pacientes
CREATE POLICY "Usuários autenticados podem gerenciar pacientes" 
ON public.pacientes 
FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Função para criar perfil automaticamente quando usuário se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'recepcionista')
  );
  RETURN NEW;
END;
$$;

-- Trigger para criar perfil quando usuário se registra
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger para atualizar updated_at nos profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();