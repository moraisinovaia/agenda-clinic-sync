
-- =====================================================
-- FASE 1: Atribuir role 'recepcionista' para os 7 usuários sem role
-- =====================================================

INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'recepcionista'::app_role
FROM public.profiles p
WHERE p.status = 'aprovado'
  AND p.email IN (
    'alanalessa001@gmail.com',
    'moraisinovaia@gmail.com', 
    'alini.clarinha@hotmail.com',
    'moraisinovaiacloud@gmail.com',
    'mirelyribeuro@gmail.com',
    'lss190787@gmail.com',
    'drmarcelodecarli@gmail.com'
  )
  AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id);

-- =====================================================
-- FASE 2: Criar função de verificação de acesso a dados de pacientes
-- =====================================================

CREATE OR REPLACE FUNCTION public.can_access_patient_data()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'admin_clinica', 'recepcionista', 'medico')
  )
$$;

-- =====================================================
-- FASE 3: Atualizar políticas RLS de pacientes
-- =====================================================

-- Remover políticas antigas permissivas
DROP POLICY IF EXISTS "Pacientes - visualizar da clínica" ON public.pacientes;
DROP POLICY IF EXISTS "Pacientes - criar na clínica" ON public.pacientes;
DROP POLICY IF EXISTS "Pacientes - atualizar da clínica" ON public.pacientes;
DROP POLICY IF EXISTS "Pacientes - deletar da clínica" ON public.pacientes;
DROP POLICY IF EXISTS "Usuários autenticados podem gerenciar pacientes" ON public.pacientes;

-- Criar novas políticas com verificação de role
CREATE POLICY "Pacientes - visualizar com role" ON public.pacientes
FOR SELECT USING (
  cliente_id = get_user_cliente_id() AND can_access_patient_data()
);

CREATE POLICY "Pacientes - criar com role" ON public.pacientes
FOR INSERT WITH CHECK (
  cliente_id = get_user_cliente_id() AND can_access_patient_data()
);

CREATE POLICY "Pacientes - atualizar com role" ON public.pacientes
FOR UPDATE USING (
  cliente_id = get_user_cliente_id() AND can_access_patient_data()
) WITH CHECK (
  cliente_id = get_user_cliente_id() AND can_access_patient_data()
);

CREATE POLICY "Pacientes - deletar apenas admins" ON public.pacientes
FOR DELETE USING (
  cliente_id = get_user_cliente_id() 
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'admin_clinica'))
);

-- =====================================================
-- FASE 4: Remover política permissiva de profiles
-- =====================================================

DROP POLICY IF EXISTS "Service role can manage profiles" ON public.profiles;

-- =====================================================
-- FASE 5: Log da operação
-- =====================================================

INSERT INTO public.system_logs (timestamp, level, message, context, data)
VALUES (
  now(),
  'info',
  '[SECURITY] Correção de segurança aplicada: roles atribuídas e políticas RLS atualizadas',
  'SECURITY_FIX',
  jsonb_build_object(
    'action', 'security_fix_applied',
    'roles_assigned', 7,
    'policies_updated', 'pacientes',
    'policies_removed', ARRAY['Service role can manage profiles'],
    'timestamp', now()
  )
);
