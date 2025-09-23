-- Dropar função existente para recriar com tipo correto
DROP FUNCTION IF EXISTS public.get_current_user_profile();

-- Criar tabela configuracoes_clinica que está faltando
CREATE TABLE IF NOT EXISTS public.configuracoes_clinica (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria TEXT NOT NULL,
  chave TEXT NOT NULL,
  valor TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  dados_extras JSONB,
  cliente_id UUID REFERENCES public.clientes(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(categoria, chave, cliente_id)
);

-- Habilitar RLS na tabela
ALTER TABLE public.configuracoes_clinica ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para configuracoes_clinica
CREATE POLICY "Usuários podem ver configurações da sua clínica" 
ON public.configuracoes_clinica 
FOR SELECT 
USING (
  cliente_id = get_user_cliente_id() OR 
  cliente_id IS NULL OR
  auth.uid() IS NOT NULL
);

CREATE POLICY "Usuários podem criar configurações da sua clínica" 
ON public.configuracoes_clinica 
FOR INSERT 
WITH CHECK (
  cliente_id = get_user_cliente_id() OR 
  cliente_id IS NULL OR
  auth.uid() IS NOT NULL
);

CREATE POLICY "Usuários podem atualizar configurações da sua clínica" 
ON public.configuracoes_clinica 
FOR UPDATE 
USING (
  cliente_id = get_user_cliente_id() OR 
  cliente_id IS NULL OR
  auth.uid() IS NOT NULL
);

CREATE POLICY "Super admin pode gerenciar todas as configurações" 
ON public.configuracoes_clinica 
FOR ALL 
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Recriar função get_current_user_profile com tipo correto
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  nome text,
  email text,
  role text,
  ativo boolean,
  status character varying,
  username character varying,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  cliente_id uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.user_id,
    p.nome,
    p.email,
    p.role,
    p.ativo,
    p.status,
    p.username,
    p.created_at,
    p.updated_at,
    p.cliente_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

-- Inserir configurações padrão do sistema
INSERT INTO public.configuracoes_clinica (categoria, chave, valor, ativo, dados_extras) VALUES
('alertas', 'alert_system', 'moraisinovaia@gmail.com', true, '{"systemDown": true, "databaseIssues": true}'::jsonb),
('alertas', 'alert_appointment', 'moraisinovaia@gmail.com', true, '{"appointmentConflicts": true}'::jsonb),
('alertas', 'alert_critical', 'moraisinovaia@gmail.com', true, '{"criticalErrors": true}'::jsonb),
('sistema', 'clinic_name', 'Endogastro', true, NULL),
('sistema', 'notification_email', 'moraisinovaia@gmail.com', true, NULL),
('sistema', 'max_appointments_per_day', '50', true, NULL)
ON CONFLICT (categoria, chave, cliente_id) DO NOTHING;

-- Adicionar trigger para updated_at na configuracoes_clinica
CREATE TRIGGER update_configuracoes_clinica_updated_at
  BEFORE UPDATE ON public.configuracoes_clinica
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();