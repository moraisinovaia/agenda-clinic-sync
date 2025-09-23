-- Fase 1: Criar função is_super_admin() e corrigir políticas RLS

-- Criar função para identificar super-admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
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

-- Atualizar política RLS da tabela clientes para super-admin
DROP POLICY IF EXISTS "Super admin can access all clientes" ON public.clientes;
CREATE POLICY "Super admin can access all clientes" 
ON public.clientes 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Atualizar política RLS da tabela profiles para super-admin
DROP POLICY IF EXISTS "Super admin can access all profiles" ON public.profiles;
CREATE POLICY "Super admin can access all profiles" 
ON public.profiles 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Garantir que super-admin pode acessar todas as tabelas principais
DROP POLICY IF EXISTS "Super admin pode gerenciar todos os medicos" ON public.medicos;
CREATE POLICY "Super admin pode gerenciar todos os medicos" 
ON public.medicos 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin pode gerenciar todos os pacientes" ON public.pacientes;
CREATE POLICY "Super admin pode gerenciar todos os pacientes" 
ON public.pacientes 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin pode gerenciar todos os agendamentos" ON public.agendamentos;
CREATE POLICY "Super admin pode gerenciar todos os agendamentos" 
ON public.agendamentos 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin pode gerenciar todos os atendimentos" ON public.atendimentos;
CREATE POLICY "Super admin pode gerenciar todos os atendimentos" 
ON public.atendimentos 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin pode gerenciar todos os bloqueios" ON public.bloqueios_agenda;
CREATE POLICY "Super admin pode gerenciar todos os bloqueios" 
ON public.bloqueios_agenda 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin pode gerenciar toda fila espera" ON public.fila_espera;
CREATE POLICY "Super admin pode gerenciar toda fila espera" 
ON public.fila_espera 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin pode gerenciar todos os preparos" ON public.preparos;
CREATE POLICY "Super admin pode gerenciar todos os preparos" 
ON public.preparos 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Políticas para tabelas IPADO
DROP POLICY IF EXISTS "Super admin pode acessar ipado_medicos" ON public.ipado_medicos;
CREATE POLICY "Super admin pode acessar ipado_medicos" 
ON public.ipado_medicos 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin pode acessar ipado_pacientes" ON public.ipado_pacientes;
CREATE POLICY "Super admin pode acessar ipado_pacientes" 
ON public.ipado_pacientes 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin pode acessar ipado_agendamentos" ON public.ipado_agendamentos;
CREATE POLICY "Super admin pode acessar ipado_agendamentos" 
ON public.ipado_agendamentos 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin pode acessar ipado_atendimentos" ON public.ipado_atendimentos;
CREATE POLICY "Super admin pode acessar ipado_atendimentos" 
ON public.ipado_atendimentos 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin pode acessar ipado_bloqueios_agenda" ON public.ipado_bloqueios_agenda;
CREATE POLICY "Super admin pode acessar ipado_bloqueios_agenda" 
ON public.ipado_bloqueios_agenda 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin pode acessar ipado_fila_espera" ON public.ipado_fila_espera;
CREATE POLICY "Super admin pode acessar ipado_fila_espera" 
ON public.ipado_fila_espera 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin pode acessar ipado_preparos" ON public.ipado_preparos;
CREATE POLICY "Super admin pode acessar ipado_preparos" 
ON public.ipado_preparos 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin pode acessar ipado_profiles" ON public.ipado_profiles;
CREATE POLICY "Super admin pode acessar ipado_profiles" 
ON public.ipado_profiles 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());