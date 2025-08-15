-- Corrigir e melhorar o sistema de webhook N8N
-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_n8n_appointment_created ON public.agendamentos;
DROP FUNCTION IF EXISTS notify_n8n_appointment_created();

-- Criar função melhorada para notificar o N8N via Edge Function
CREATE OR REPLACE FUNCTION notify_n8n_appointment_created()
RETURNS TRIGGER AS $$
DECLARE
  webhook_enabled BOOLEAN := false;
  supabase_url TEXT;
  anon_key TEXT;
  service_role_key TEXT;
  webhook_url TEXT := 'https://n8n.inovaia.online/webhook-test/whatsapp-webhook';
BEGIN
  -- Log do trigger sendo executado
  INSERT INTO public.system_logs (
    timestamp, level, message, context, data
  ) VALUES (
    now(), 'info', 
    'Trigger N8N webhook executado para agendamento ' || NEW.id::text,
    'N8N_TRIGGER',
    jsonb_build_object('agendamento_id', NEW.id, 'status', NEW.status)
  );

  -- Verificar se o webhook está habilitado
  SELECT value::boolean INTO webhook_enabled 
  FROM public.system_settings 
  WHERE key = 'n8n_webhook_enabled' AND value::boolean = true
  LIMIT 1;

  IF NOT webhook_enabled THEN
    INSERT INTO public.system_logs (
      timestamp, level, message, context, data
    ) VALUES (
      now(), 'info', 
      'N8N webhook desabilitado, pulando envio',
      'N8N_TRIGGER_SKIP',
      jsonb_build_object('agendamento_id', NEW.id)
    );
    RETURN NEW;
  END IF;

  -- Buscar configurações do Supabase
  SELECT current_setting('app.settings.supabase_url', true) INTO supabase_url;
  SELECT current_setting('app.settings.anon_key', true) INTO anon_key;

  -- Se não encontrar as configurações, usar valores padrão
  IF supabase_url IS NULL OR supabase_url = '' THEN
    supabase_url := 'https://qxlvzbvzajibdtlzngdy.supabase.co';
  END IF;

  IF anon_key IS NULL OR anon_key = '' THEN
    anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MDg5MzMsImV4cCI6MjA2NjA4NDkzM30.iLhYwcxvF-2wBe3uWllrxMItGpQ09OA8c8_7VMlRDw8';
  END IF;

  -- Executar chamada HTTP para a Edge Function usando pg_net (mais confiável)
  BEGIN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/n8n-webhook',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key,
        'apikey', anon_key
      ),
      body := jsonb_build_object(
        'agendamento_id', NEW.id,
        'paciente_id', NEW.paciente_id,
        'medico_id', NEW.medico_id,
        'atendimento_id', NEW.atendimento_id,
        'data_agendamento', NEW.data_agendamento,
        'hora_agendamento', NEW.hora_agendamento,
        'status', NEW.status,
        'observacoes', NEW.observacoes,
        'convenio', NEW.convenio,
        'criado_por', NEW.criado_por,
        'criado_por_user_id', NEW.criado_por_user_id
      ),
      timeout_milliseconds := 30000
    );

    -- Log de sucesso da chamada HTTP
    INSERT INTO public.system_logs (
      timestamp, level, message, context, data
    ) VALUES (
      now(), 'info', 
      'Chamada HTTP para n8n-webhook Edge Function enviada com sucesso',
      'N8N_TRIGGER_SUCCESS',
      jsonb_build_object(
        'agendamento_id', NEW.id,
        'url', supabase_url || '/functions/v1/n8n-webhook'
      )
    );

  EXCEPTION
    WHEN others THEN
      -- Log do erro na chamada HTTP
      INSERT INTO public.system_logs (
        timestamp, level, message, context, data
      ) VALUES (
        now(), 'error', 
        'Erro ao chamar n8n-webhook Edge Function: ' || SQLERRM,
        'N8N_TRIGGER_ERROR',
        jsonb_build_object(
          'agendamento_id', NEW.id,
          'error', SQLERRM,
          'url', supabase_url || '/functions/v1/n8n-webhook'
        )
      );
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger atualizado
CREATE TRIGGER trigger_n8n_appointment_created
AFTER INSERT ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION notify_n8n_appointment_created();

-- Garantir que as configurações do webhook estão definidas
INSERT INTO public.system_settings (key, value, description, category, type) 
VALUES 
  ('n8n_webhook_enabled', 'true', 'Habilitar webhooks N8N para novos agendamentos', 'integrations', 'boolean'),
  ('n8n_webhook_url', 'https://n8n.inovaia.online/webhook-test/whatsapp-webhook', 'URL do webhook N8N', 'integrations', 'string'),
  ('n8n_webhook_retries', '3', 'Número de tentativas para envio do webhook N8N', 'integrations', 'number'),
  ('n8n_webhook_timeout', '30000', 'Timeout em millisegundos para webhook N8N', 'integrations', 'number')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

-- Log da correção aplicada
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info', 
  'Sistema de webhook N8N corrigido e reconfigurado',
  'N8N_SYSTEM_FIX',
  jsonb_build_object(
    'trigger_recreated', true,
    'settings_updated', true,
    'webhook_url', 'https://n8n.inovaia.online/webhook-test/whatsapp-webhook'
  )
);