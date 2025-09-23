-- Criar tabela de auditoria que está faltando
CREATE TABLE IF NOT EXISTS public.access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  resource text NOT NULL,
  details jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.access_audit ENABLE ROW LEVEL SECURITY;

-- Política para admins verem tudo
CREATE POLICY "Admins can view all audit logs" ON public.access_audit
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND status = 'aprovado'
  )
);

-- Política para permitir inserção via trigger
CREATE POLICY "Allow audit insertions" ON public.access_audit
FOR INSERT WITH CHECK (true);

-- Agora alterar o usuário para admin
UPDATE public.profiles 
SET role = 'admin'
WHERE email = 'teste@exemplo.com';