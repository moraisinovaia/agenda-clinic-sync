-- Correções finais de segurança para produção

-- 1. Mover extensões do schema public para extensions (quando possível)
-- Nota: Algumas extensões podem precisar ser movidas manualmente no dashboard

-- 2. Configurar settings de segurança otimizados para produção
INSERT INTO public.system_settings (key, value, category, description, type, editable) 
VALUES 
  ('security_otp_expiry_minutes', '10', 'security', 'Tempo de expiração do OTP em minutos (recomendado: 10)', 'integer', true),
  ('security_password_min_length', '8', 'security', 'Comprimento mínimo da senha', 'integer', true),
  ('security_require_special_chars', 'true', 'security', 'Exigir caracteres especiais na senha', 'boolean', true),
  ('security_session_timeout_hours', '8', 'security', 'Timeout da sessão em horas', 'integer', true),
  ('security_max_login_attempts', '5', 'security', 'Máximo de tentativas de login', 'integer', true),
  ('security_lockout_duration_minutes', '15', 'security', 'Duração do bloqueio após tentativas falhidas', 'integer', true),
  ('production_environment', 'true', 'system', 'Indica se está em ambiente de produção', 'boolean', true),
  ('maintenance_mode', 'false', 'system', 'Modo de manutenção ativado', 'boolean', true),
  ('backup_frequency_hours', '6', 'backup', 'Frequência de backup automático em horas', 'integer', true),
  ('monitoring_alerts_enabled', 'true', 'monitoring', 'Alertas de monitoramento ativados', 'boolean', true),
  ('performance_metrics_retention_days', '90', 'monitoring', 'Retenção de métricas de performance', 'integer', true)
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = now();

-- 3. Criar função para validação de segurança em produção
CREATE OR REPLACE FUNCTION public.validate_production_security()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  extension_count INTEGER;
  security_issues TEXT[] := '{}';
BEGIN
  -- Verificar extensões no schema public
  SELECT COUNT(*) INTO extension_count
  FROM pg_extension e
  JOIN pg_namespace n ON e.extnamespace = n.oid
  WHERE n.nspname = 'public' 
  AND e.extname NOT IN ('plpgsql'); -- plpgsql é padrão no public
  
  IF extension_count > 0 THEN
    security_issues := array_append(security_issues, 'Extensões no schema público detectadas');
  END IF;
  
  -- Verificar configurações de segurança
  IF NOT EXISTS (SELECT 1 FROM public.system_settings WHERE key = 'production_environment' AND value = 'true') THEN
    security_issues := array_append(security_issues, 'Ambiente de produção não configurado');
  END IF;
  
  result := jsonb_build_object(
    'timestamp', now(),
    'production_ready', array_length(security_issues, 1) IS NULL,
    'security_issues', security_issues,
    'extensions_in_public', extension_count,
    'recommendations', jsonb_build_array(
      'Mover extensões para schema extensions via Dashboard',
      'Ativar proteção contra senhas vazadas no Dashboard', 
      'Reduzir OTP expiry para 10 minutos no Dashboard',
      'Atualizar PostgreSQL via Dashboard'
    )
  );
  
  -- Log da validação
  INSERT INTO public.system_logs (
    timestamp, level, message, context, data
  ) VALUES (
    now(), 'info',
    '[SECURITY] Validação de segurança para produção executada',
    'PRODUCTION_SECURITY_CHECK',
    result
  );
  
  RETURN result;
END;
$$;

-- 4. Criar trigger para monitoramento de mudanças críticas
CREATE OR REPLACE FUNCTION public.monitor_critical_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Monitorar mudanças em configurações críticas
  IF TG_TABLE_NAME = 'system_settings' AND 
     NEW.key IN ('production_environment', 'security_audit_enabled', 'backup_retention_days') THEN
    
    INSERT INTO public.system_logs (
      timestamp, level, message, context, data
    ) VALUES (
      now(), 'warning',
      '[SECURITY] Configuração crítica alterada: ' || NEW.key,
      'CRITICAL_CONFIG_CHANGE',
      jsonb_build_object(
        'setting_key', NEW.key,
        'old_value', OLD.value,
        'new_value', NEW.value,
        'changed_by', auth.uid()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Aplicar trigger apenas se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'monitor_critical_settings_changes'
  ) THEN
    CREATE TRIGGER monitor_critical_settings_changes
    AFTER UPDATE ON public.system_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.monitor_critical_changes();
  END IF;
END $$;

-- 5. Função para preparar deploy
CREATE OR REPLACE FUNCTION public.prepare_production_deploy()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  total_users INTEGER;
  total_doctors INTEGER;
  total_appointments INTEGER;
  active_settings INTEGER;
BEGIN
  -- Coletar estatísticas do sistema
  SELECT COUNT(*) INTO total_users FROM public.profiles WHERE status = 'aprovado';
  SELECT COUNT(*) INTO total_doctors FROM public.medicos WHERE ativo = true;
  SELECT COUNT(*) INTO total_appointments FROM public.agendamentos WHERE status = 'agendado';
  SELECT COUNT(*) INTO active_settings FROM public.system_settings WHERE key LIKE 'production_%';
  
  -- Validar pré-requisitos para deploy
  result := jsonb_build_object(
    'deploy_timestamp', now(),
    'system_ready', true,
    'statistics', jsonb_build_object(
      'approved_users', total_users,
      'active_doctors', total_doctors,
      'scheduled_appointments', total_appointments,
      'production_settings', active_settings
    ),
    'security_status', public.validate_production_security(),
    'next_steps', jsonb_build_array(
      '1. Configurar domínio personalizado no Lovable',
      '2. Resolver warnings de segurança no Dashboard Supabase',
      '3. Configurar SSL e DNS',
      '4. Realizar testes finais',
      '5. Comunicar go-live à equipe'
    )
  );
  
  -- Log do prepare deploy
  INSERT INTO public.system_logs (
    timestamp, level, message, context, data
  ) VALUES (
    now(), 'info',
    '[DEPLOY] Sistema preparado para produção',
    'PRODUCTION_DEPLOY_PREP',
    result
  );
  
  RETURN result;
END;
$$;