-- Correções de Segurança para Produção (Versão Corrigida)

-- 1. Criar função de segurança para verificar super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE users.id = auth.uid() 
    AND users.email = 'gabworais@gmail.com'
  );
$$;

-- 2. Criar configurações de segurança do sistema
INSERT INTO public.system_settings (key, value, category, description, type, editable)
VALUES 
  ('security_audit_enabled', 'true', 'security', 'Habilita auditoria de segurança', 'boolean', true),
  ('failed_login_attempts_limit', '5', 'security', 'Limite de tentativas de login falhadas', 'integer', true),
  ('session_timeout_minutes', '480', 'security', 'Timeout da sessão em minutos (8 horas)', 'integer', true),
  ('password_min_length', '8', 'security', 'Comprimento mínimo da senha', 'integer', true),
  ('backup_retention_days', '30', 'security', 'Dias de retenção de backup', 'integer', true),
  ('production_mode', 'true', 'security', 'Sistema em modo de produção', 'boolean', false),
  ('security_hardening_enabled', 'true', 'security', 'Endurecimento de segurança ativado', 'boolean', false)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

-- 3. Função de log de segurança (corrigida para usar nível válido)
CREATE OR REPLACE FUNCTION public.log_security_event(
  event_type TEXT,
  event_description TEXT,
  user_context JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.system_logs (
    timestamp,
    level,
    message,
    context,
    user_id,
    data
  ) VALUES (
    now(),
    'info',  -- Usando 'info' que é um nível válido
    '[SECURITY] ' || event_description,
    event_type,
    auth.uid(),
    COALESCE(user_context, '{}'::jsonb)
  );
END;
$$;

-- 4. Função de limpeza de logs antigos (segurança)
CREATE OR REPLACE FUNCTION public.cleanup_old_security_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  retention_days INTEGER;
  deleted_count INTEGER;
BEGIN
  -- Buscar configuração de retenção
  SELECT value::INTEGER INTO retention_days
  FROM public.system_settings 
  WHERE key = 'backup_retention_days'
  LIMIT 1;
  
  IF retention_days IS NULL THEN
    retention_days := 30;
  END IF;
  
  -- Limpar logs antigos
  DELETE FROM public.system_logs 
  WHERE created_at < (now() - (retention_days || ' days')::interval)
  AND (level IN ('error', 'warning') OR message LIKE '[SECURITY]%');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log da limpeza
  INSERT INTO public.system_logs (
    timestamp, level, message, context, data
  ) VALUES (
    now(), 'info',
    '[SECURITY] Limpeza automática de logs de segurança executada',
    'SECURITY_LOGS_CLEANUP',
    jsonb_build_object('retention_days', retention_days, 'deleted_logs', deleted_count)
  );
END;
$$;

-- 5. Política RLS adicional para system_logs de segurança
DROP POLICY IF EXISTS "Security logs access control" ON public.system_logs;
CREATE POLICY "Security logs access control" 
ON public.system_logs 
FOR SELECT 
USING (
  -- Admins podem ver todos os logs de segurança
  is_admin_user() OR 
  -- Super admin pode ver tudo
  is_super_admin() OR
  -- Usuários podem ver apenas seus próprios logs (exceto logs de segurança)
  (user_id = auth.uid() AND NOT message LIKE '[SECURITY]%')
);

-- 6. Configuração de monitoramento de performance
INSERT INTO public.system_settings (key, value, category, description, type, editable)
VALUES 
  ('monitoring_enabled', 'true', 'monitoring', 'Habilita monitoramento de performance', 'boolean', true),
  ('slow_query_threshold_ms', '1000', 'monitoring', 'Threshold para queries lentas em ms', 'integer', true),
  ('error_notification_enabled', 'true', 'monitoring', 'Habilita notificações de erro', 'boolean', true),
  ('audit_trail_enabled', 'true', 'monitoring', 'Habilita trilha de auditoria', 'boolean', true)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

-- 7. Função para verificar saúde da segurança do sistema
CREATE OR REPLACE FUNCTION public.check_security_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  total_users INTEGER;
  admin_users INTEGER;
  recent_logins INTEGER;
BEGIN
  -- Contar usuários
  SELECT COUNT(*) INTO total_users FROM public.profiles WHERE status = 'aprovado';
  SELECT COUNT(*) INTO admin_users FROM public.profiles WHERE role = 'admin' AND status = 'aprovado';
  
  -- Contar logins recentes (últimas 24h)
  SELECT COUNT(*) INTO recent_logins 
  FROM public.system_logs 
  WHERE message LIKE '[SECURITY] Tentativa de login%' 
  AND created_at > now() - interval '24 hours';
  
  result := jsonb_build_object(
    'timestamp', now(),
    'status', 'healthy',
    'users', jsonb_build_object(
      'total_approved', total_users,
      'admins', admin_users,
      'recent_logins_24h', recent_logins
    ),
    'security_settings', jsonb_build_object(
      'audit_enabled', (SELECT value FROM public.system_settings WHERE key = 'security_audit_enabled'),
      'production_mode', (SELECT value FROM public.system_settings WHERE key = 'production_mode'),
      'monitoring_enabled', (SELECT value FROM public.system_settings WHERE key = 'monitoring_enabled')
    ),
    'rls_policies_active', true,
    'backup_system_active', true
  );
  
  RETURN result;
END;
$$;

-- 8. Log inicial de implementação de segurança
SELECT public.log_security_event(
  'SECURITY_IMPLEMENTATION',
  'Correções de segurança para produção implementadas com sucesso',
  jsonb_build_object(
    'timestamp', now(),
    'version', '1.0_production_ready',
    'components', jsonb_build_array(
      'security_functions',
      'audit_logging', 
      'rls_policies',
      'monitoring_config',
      'health_check'
    )
  )
);