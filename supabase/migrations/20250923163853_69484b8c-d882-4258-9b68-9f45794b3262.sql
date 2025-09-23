-- Criar tabela de auditoria do super admin
CREATE TABLE public.super_admin_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_client_id UUID,
  target_user_id UUID,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.super_admin_audit ENABLE ROW LEVEL SECURITY;

-- Policy para super admin ver todos os logs
CREATE POLICY "Super admin pode ver audit logs"
ON public.super_admin_audit
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND email = 'gabworais@gmail.com' 
    AND role = 'admin' 
    AND status = 'aprovado'
  )
);

-- Policy para inserir logs de auditoria
CREATE POLICY "Service pode inserir audit logs"
ON public.super_admin_audit
FOR INSERT
WITH CHECK (true);

-- Função para log de auditoria do super admin
CREATE OR REPLACE FUNCTION public.log_super_admin_action(
  p_action TEXT,
  p_target_client_id UUID DEFAULT NULL,
  p_target_user_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO public.super_admin_audit (
    admin_id,
    action,
    target_client_id,
    target_user_id,
    details
  ) VALUES (
    auth.uid(),
    p_action,
    p_target_client_id,
    p_target_user_id,
    p_details
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- Função para verificar se é super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND email = 'gabworais@gmail.com' 
    AND role = 'admin' 
    AND status = 'aprovado'
  );
$$;