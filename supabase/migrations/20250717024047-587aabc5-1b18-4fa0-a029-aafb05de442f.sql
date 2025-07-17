-- ====================================================================
-- CORREÇÕES DE SEGURANÇA PARA PRODUÇÃO
-- ====================================================================

-- 1. CORRIGIR SEARCH_PATH EM FUNÇÕES EXISTENTES
-- ====================================================================

-- Atualizar função aprovar_usuario
CREATE OR REPLACE FUNCTION public.aprovar_usuario(p_user_id uuid, p_aprovador_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_email TEXT;
BEGIN
  -- Verificar se o aprovador é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_aprovador_id 
    AND role = 'admin' 
    AND status = 'aprovado'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem aprovar usuários'
    );
  END IF;

  -- Buscar o email do usuário
  SELECT email INTO user_email
  FROM public.profiles 
  WHERE id = p_user_id;

  IF user_email IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;

  -- Aprovar o usuário
  UPDATE public.profiles 
  SET 
    status = 'aprovado',
    aprovado_por = p_aprovador_id,
    data_aprovacao = now()
  WHERE id = p_user_id;

  -- Confirmar o email automaticamente
  UPDATE auth.users 
  SET 
    email_confirmed_at = now(),
    confirmed_at = now()
  WHERE email = user_email AND email_confirmed_at IS NULL;

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário aprovado e email confirmado automaticamente'
  );
END;
$function$;

-- Atualizar função rejeitar_usuario
CREATE OR REPLACE FUNCTION public.rejeitar_usuario(p_user_id uuid, p_aprovador_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Verificar se o aprovador é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_aprovador_id 
    AND role = 'admin' 
    AND status = 'aprovado'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem rejeitar usuários'
    );
  END IF;

  -- Rejeitar o usuário
  UPDATE public.profiles 
  SET 
    status = 'rejeitado',
    aprovado_por = p_aprovador_id,
    data_aprovacao = now()
  WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário rejeitado'
  );
END;
$function$;

-- Atualizar função confirmar_email_usuario_aprovado
CREATE OR REPLACE FUNCTION public.confirmar_email_usuario_aprovado(p_user_email text, p_admin_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Verificar se quem está fazendo a ação é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = p_admin_id 
    AND role = 'admin' 
    AND status = 'aprovado'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem confirmar emails'
    );
  END IF;

  -- Verificar se o usuário está aprovado
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE email = p_user_email 
    AND status = 'aprovado'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário deve estar aprovado antes de confirmar email'
    );
  END IF;

  -- Confirmar o email
  UPDATE auth.users 
  SET email_confirmed_at = now()
  WHERE email = p_user_email AND email_confirmed_at IS NULL;

  IF FOUND THEN
    RETURN json_build_object(
      'success', true,
      'message', 'Email confirmado com sucesso'
    );
  ELSE
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado ou email já confirmado'
    );
  END IF;
END;
$function$;

-- Atualizar função is_admin_safe
CREATE OR REPLACE FUNCTION public.is_admin_safe(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE 
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = p_user_id 
    AND role = 'admin' 
    AND status = 'aprovado'
    LIMIT 1
  );
$function$;

-- Atualizar função get_user_role_safe
CREATE OR REPLACE FUNCTION public.get_user_role_safe(p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE 
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE user_id = p_user_id LIMIT 1),
    'none'
  );
$function$;

-- Atualizar função get_pending_users_safe
CREATE OR REPLACE FUNCTION public.get_pending_users_safe()
 RETURNS TABLE(id uuid, nome text, email text, username character varying, role text, created_at timestamp with time zone, aprovado_por_nome text)
 LANGUAGE sql
 STABLE 
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.id,
    p.nome,
    p.email,
    p.username,
    p.role,
    p.created_at,
    a.nome as aprovado_por_nome
  FROM public.profiles p
  LEFT JOIN public.profiles a ON p.aprovado_por = a.id
  WHERE p.status = 'pendente'
    AND public.is_admin_safe(auth.uid())
  ORDER BY p.created_at ASC;
$function$;

-- Atualizar função cleanup_old_logs
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.system_logs 
  WHERE created_at < now() - interval '30 days';
END;
$function$;

-- Atualizar função cleanup_expired_backups
CREATE OR REPLACE FUNCTION public.cleanup_expired_backups()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.system_backups 
  WHERE expires_at < now();
  
  -- Log da limpeza
  INSERT INTO public.system_logs (
    timestamp,
    level,
    message,
    context,
    created_at
  ) VALUES (
    now(),
    'info',
    'Limpeza automática de backups expirados executada',
    'BACKUP_CLEANUP',
    now()
  );
END;
$function$;

-- 2. REMOVER VIEWS COM SECURITY DEFINER (SUBSTITUIR POR VIEWS NORMAIS)
-- ====================================================================

-- Recriar views sem SECURITY DEFINER
DROP VIEW IF EXISTS public.vw_agente_alertas;
CREATE VIEW public.vw_agente_alertas AS
SELECT 
  cc.chave,
  cc.valor,
  CASE 
    WHEN cc.chave = 'alert_critical' THEN 'alta'
    WHEN cc.chave = 'alert_system' THEN 'media'
    ELSE 'baixa'
  END as prioridade,
  cc.dados_extras,
  cc.categoria
FROM public.configuracoes_clinica cc
WHERE cc.categoria = 'alertas' 
  AND cc.ativo = true;

DROP VIEW IF EXISTS public.vw_agente_convenios;
CREATE VIEW public.vw_agente_convenios AS
SELECT 
  cc.valor as convenio,
  'configuracao' as tipo,
  'Convênio configurado no sistema' as informacao,
  cc.dados_extras
FROM public.configuracoes_clinica cc
WHERE cc.categoria = 'convenios' 
  AND cc.ativo = true;

DROP VIEW IF EXISTS public.vw_agente_medicos;
CREATE VIEW public.vw_agente_medicos AS
SELECT 
  m.nome as medico,
  m.especialidade,
  m.convenios_aceitos,
  m.convenios_restricoes,
  m.idade_minima,
  m.horarios,
  m.observacoes as obs_medico,
  a.nome as nome_atendimento,
  a.tipo as tipo_atendimento,
  a.valor_particular,
  a.coparticipacao_20,
  a.coparticipacao_40,
  a.forma_pagamento,
  a.observacoes as obs_atendimento
FROM public.medicos m
LEFT JOIN public.atendimentos a ON m.id = a.medico_id
WHERE m.ativo = true 
  AND (a.ativo IS NULL OR a.ativo = true);

DROP VIEW IF EXISTS public.vw_agente_preparos;
CREATE VIEW public.vw_agente_preparos AS
SELECT 
  p.nome,
  p.exame,
  p.instrucoes,
  p.jejum_horas,
  p.dias_suspensao,
  p.medicacao_suspender,
  p.restricoes_alimentares,
  p.itens_levar,
  p.observacoes_especiais
FROM public.preparos p;

-- 3. CONFIGURAR POLÍTICAS RLS MAIS RESTRITIVAS PARA AS VIEWS
-- ====================================================================

-- Views herdam RLS das tabelas base, então não precisamos de políticas específicas

-- 4. ADICIONAR TRIGGER PARA AUDITORIA DE ACESSO SENSÍVEL
-- ====================================================================

-- Criar tabela de auditoria de acesso
CREATE TABLE IF NOT EXISTS public.access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  resource text NOT NULL,
  ip_address inet,
  user_agent text,
  success boolean DEFAULT true,
  details jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS na tabela de auditoria
ALTER TABLE public.access_audit ENABLE ROW LEVEL SECURITY;

-- Política para admins verem auditoria
CREATE POLICY "Admins podem ver auditoria de acesso"
ON public.access_audit FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND status = 'aprovado'
  )
);

-- Service role pode inserir logs de auditoria
CREATE POLICY "Service role pode inserir auditoria"
ON public.access_audit FOR INSERT
WITH CHECK (true);

-- 5. ADICIONAR FUNÇÃO PARA LOG DE AUDITORIA
-- ====================================================================

CREATE OR REPLACE FUNCTION public.log_access_audit(
  p_action text,
  p_resource text,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.access_audit (
    user_id,
    action,
    resource,
    details
  ) VALUES (
    auth.uid(),
    p_action,
    p_resource,
    p_details
  );
END;
$function$;

-- 6. MELHORAR POLÍTICA DE SENHAS (COMENTÁRIO INFORMATIVO)
-- ====================================================================

-- NOTA: As seguintes configurações devem ser feitas via dashboard do Supabase:
-- 1. Authentication > Settings > Password Policy:
--    - Minimum length: 8 characters
--    - Require uppercase: true
--    - Require lowercase: true  
--    - Require numbers: true
--    - Require special characters: true
--    - Enable leaked password protection: true
--
-- 2. Authentication > Settings > Advanced:
--    - OTP expiry: 3600 (1 hour)
--    - Enable secure password reset: true

-- 7. ADICIONAR ÍNDICES PARA PERFORMANCE EM PRODUÇÃO
-- ====================================================================

-- Índices para auditoria
CREATE INDEX IF NOT EXISTS idx_access_audit_user_id ON public.access_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_access_audit_created_at ON public.access_audit(created_at);
CREATE INDEX IF NOT EXISTS idx_access_audit_resource ON public.access_audit(resource);

-- Índices para agendamentos (performance)
CREATE INDEX IF NOT EXISTS idx_agendamentos_data_medico ON public.agendamentos(data_agendamento, medico_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON public.agendamentos(status);
CREATE INDEX IF NOT EXISTS idx_agendamentos_paciente_data ON public.agendamentos(paciente_id, data_agendamento);

-- Índices para profiles (performance)
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 8. TRIGGER PARA MONITORAMENTO DE ALTERAÇÕES CRÍTICAS
-- ====================================================================

CREATE OR REPLACE FUNCTION public.monitor_critical_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Log alterações em profiles de admin
  IF TG_TABLE_NAME = 'profiles' AND NEW.role = 'admin' THEN
    PERFORM public.log_access_audit(
      TG_OP,
      'admin_profile_change',
      jsonb_build_object(
        'profile_id', NEW.id,
        'old_role', COALESCE(OLD.role, 'none'),
        'new_role', NEW.role,
        'old_status', COALESCE(OLD.status, 'none'),
        'new_status', NEW.status
      )
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Aplicar trigger nos profiles
DROP TRIGGER IF EXISTS trigger_monitor_profiles ON public.profiles;
CREATE TRIGGER trigger_monitor_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.monitor_critical_changes();

-- ====================================================================
-- FIM DAS CORREÇÕES DE SEGURANÇA
-- ====================================================================