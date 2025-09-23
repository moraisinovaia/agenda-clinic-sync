-- Criar função para verificar se é super-admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND email = 'gabworais@gmail.com'
    AND role = 'admin' 
    AND status = 'aprovado'
  );
$$;

-- Adicionar políticas de super-admin para todas as tabelas principais

-- Agendamentos
CREATE POLICY "Super admin pode ver todos os agendamentos"
ON public.agendamentos
FOR SELECT
USING (public.is_super_admin());

CREATE POLICY "Super admin pode gerenciar todos os agendamentos"
ON public.agendamentos
FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Pacientes
CREATE POLICY "Super admin pode ver todos os pacientes"
ON public.pacientes
FOR SELECT
USING (public.is_super_admin());

CREATE POLICY "Super admin pode gerenciar todos os pacientes"
ON public.pacientes
FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Médicos
CREATE POLICY "Super admin pode gerenciar todos os médicos"
ON public.medicos
FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Atendimentos
CREATE POLICY "Super admin pode gerenciar todos os atendimentos"
ON public.atendimentos
FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Bloqueios agenda
CREATE POLICY "Super admin pode gerenciar todos os bloqueios"
ON public.bloqueios_agenda
FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Fila espera
CREATE POLICY "Super admin pode gerenciar toda fila espera"
ON public.fila_espera
FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Preparos
CREATE POLICY "Super admin pode gerenciar todos os preparos"
ON public.preparos
FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- IPADO Tables - Super admin access
CREATE POLICY "Super admin pode acessar ipado_agendamentos"
ON public.ipado_agendamentos
FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin pode acessar ipado_pacientes"
ON public.ipado_pacientes
FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin pode acessar ipado_medicos"
ON public.ipado_medicos
FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin pode acessar ipado_atendimentos"
ON public.ipado_atendimentos
FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin pode acessar ipado_bloqueios_agenda"
ON public.ipado_bloqueios_agenda
FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin pode acessar ipado_fila_espera"
ON public.ipado_fila_espera
FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin pode acessar ipado_preparos"
ON public.ipado_preparos
FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin pode acessar ipado_profiles"
ON public.ipado_profiles
FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());