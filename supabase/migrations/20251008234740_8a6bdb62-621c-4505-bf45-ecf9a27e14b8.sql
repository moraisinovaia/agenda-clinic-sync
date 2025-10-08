-- Correção de funções RPC e políticas após remoção da coluna role

-- 1. DROP e recriar get_current_user_profile sem role
DROP FUNCTION IF EXISTS public.get_current_user_profile();

CREATE FUNCTION public.get_current_user_profile()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  nome text,
  email text,
  ativo boolean,
  status character varying,
  username character varying,
  cliente_id uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT 
    p.id,
    p.user_id,
    p.nome,
    p.email,
    p.ativo,
    p.status,
    p.username,
    p.cliente_id,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

-- 2. DROP e recriar buscar_agendamentos_otimizado sem role
DROP FUNCTION IF EXISTS public.buscar_agendamentos_otimizado();

CREATE FUNCTION public.buscar_agendamentos_otimizado()
RETURNS TABLE(
  id uuid,
  paciente_id uuid,
  paciente_nome character varying,
  paciente_convenio character varying,
  paciente_telefone character varying,
  paciente_celular character varying,
  medico_id uuid,
  medico_nome character varying,
  atendimento_id uuid,
  atendimento_nome character varying,
  data_agendamento date,
  hora_agendamento time,
  status character varying,
  observacoes text,
  convenio character varying,
  criado_por text,
  criado_por_user_id uuid,
  created_at timestamp with time zone,
  confirmado_por text,
  confirmado_em timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    a.id,
    a.paciente_id,
    p.nome_completo as paciente_nome,
    p.convenio as paciente_convenio,
    p.telefone as paciente_telefone,
    p.celular as paciente_celular,
    a.medico_id,
    m.nome as medico_nome,
    a.atendimento_id,
    at.nome as atendimento_nome,
    a.data_agendamento,
    a.hora_agendamento,
    a.status,
    a.observacoes,
    a.convenio,
    a.criado_por,
    a.criado_por_user_id,
    a.created_at,
    a.confirmado_por,
    a.confirmado_em
  FROM public.agendamentos a
  LEFT JOIN public.pacientes p ON a.paciente_id = p.id
  LEFT JOIN public.medicos m ON a.medico_id = m.id
  LEFT JOIN public.atendimentos at ON a.atendimento_id = at.id
  WHERE a.cliente_id = get_user_cliente_id()
  ORDER BY a.data_agendamento DESC, a.hora_agendamento DESC;
$$;

-- 3. Corrigir políticas de configuracoes_clinica
DROP POLICY IF EXISTS "configuracoes_clinica_select_policy" ON public.configuracoes_clinica;
DROP POLICY IF EXISTS "configuracoes_clinica_insert_policy" ON public.configuracoes_clinica;
DROP POLICY IF EXISTS "configuracoes_clinica_update_policy" ON public.configuracoes_clinica;
DROP POLICY IF EXISTS "configuracoes_clinica_delete_policy" ON public.configuracoes_clinica;

CREATE POLICY "configuracoes_clinica_select_policy"
ON public.configuracoes_clinica FOR SELECT
TO authenticated
USING (
  cliente_id IS NULL OR 
  cliente_id = get_user_cliente_id() OR 
  auth.uid() IS NOT NULL
);

CREATE POLICY "configuracoes_clinica_insert_policy"
ON public.configuracoes_clinica FOR INSERT
TO authenticated
WITH CHECK (
  (cliente_id = get_user_cliente_id() OR has_role(auth.uid(), 'admin')) 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "configuracoes_clinica_update_policy"
ON public.configuracoes_clinica FOR UPDATE
TO authenticated
USING (
  (cliente_id = get_user_cliente_id() OR has_role(auth.uid(), 'admin'))
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "configuracoes_clinica_delete_policy"
ON public.configuracoes_clinica FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 4. Adicionar política para usuários verem seu próprio perfil
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 5. Log da correção
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info',
  '[FIX] Funções RPC e políticas corrigidas após migração de roles',
  'POST_MIGRATION_FIX',
  jsonb_build_object(
    'functions_fixed', jsonb_build_array('get_current_user_profile', 'buscar_agendamentos_otimizado'),
    'policies_fixed', jsonb_build_array('configuracoes_clinica', 'profiles'),
    'fixed_at', now()
  )
);