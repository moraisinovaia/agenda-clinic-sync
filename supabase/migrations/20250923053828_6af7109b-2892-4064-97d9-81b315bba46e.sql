-- Criar tabela ipado_profiles para funcionários/usuários do IPADO
CREATE TABLE public.ipado_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nome text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'recepcionista'::text,
  ativo boolean DEFAULT true,
  username character varying,
  status character varying NOT NULL DEFAULT 'pendente'::character varying,
  aprovado_por uuid,
  data_aprovacao timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS na tabela
ALTER TABLE public.ipado_profiles ENABLE ROW LEVEL SECURITY;

-- Criar política de acesso para usuários do IPADO
CREATE POLICY "IPADO users can access ipado_profiles"
ON public.ipado_profiles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.clientes c ON p.cliente_id = c.id
    WHERE p.user_id = auth.uid()
    AND c.nome = 'IPADO'
    AND p.status = 'aprovado'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.clientes c ON p.cliente_id = c.id
    WHERE p.user_id = auth.uid()
    AND c.nome = 'IPADO'
    AND p.status = 'aprovado'
  )
);

-- Criar trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_ipado_profiles_updated_at
  BEFORE UPDATE ON public.ipado_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices para melhor performance
CREATE INDEX idx_ipado_profiles_user_id ON public.ipado_profiles(user_id);
CREATE INDEX idx_ipado_profiles_status ON public.ipado_profiles(status);
CREATE INDEX idx_ipado_profiles_role ON public.ipado_profiles(role);