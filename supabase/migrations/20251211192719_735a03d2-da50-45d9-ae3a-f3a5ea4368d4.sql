-- Fase 1.2: Criar função de verificação de acesso por clínica
-- Esta função verifica se o usuário é admin global OU admin_clinica da clínica específica
CREATE OR REPLACE FUNCTION public.has_clinic_admin_access(
  _user_id uuid, 
  _cliente_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- É admin global?
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role = 'admin'
  ) OR EXISTS (
    -- É admin_clinica desta clínica específica?
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = _user_id 
      AND ur.role = 'admin_clinica'
      AND p.cliente_id = _cliente_id
  )
$$;

-- Fase 1.3: Criar função auxiliar para verificar se usuário é admin_clinica (qualquer clínica)
CREATE OR REPLACE FUNCTION public.is_clinic_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role = 'admin_clinica'
  )
$$;

-- Fase 1.4: Criar função para obter o cliente_id do admin_clinica
CREATE OR REPLACE FUNCTION public.get_clinic_admin_cliente_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.cliente_id 
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE ur.user_id = _user_id 
    AND ur.role = 'admin_clinica'
  LIMIT 1
$$;