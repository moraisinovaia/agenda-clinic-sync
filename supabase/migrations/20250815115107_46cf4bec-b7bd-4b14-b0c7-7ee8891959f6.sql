-- Inserir configurações padrão do N8N webhook
INSERT INTO public.system_settings (key, value, description, category, type) VALUES
('n8n_webhook_url', 'https://n8n.inovaia.online/webhook-test/whatsapp-webhook', 'URL do webhook N8N para agendamentos', 'n8n', 'string'),
('n8n_webhook_enabled', 'true', 'Habilitar envio automático para N8N', 'n8n', 'boolean'),
('n8n_webhook_retries', '3', 'Número de tentativas em caso de falha', 'n8n', 'integer'),
('n8n_webhook_timeout', '30', 'Timeout em segundos para webhook N8N', 'n8n', 'integer')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  type = EXCLUDED.type,
  updated_at = now();

-- Função para chamar o webhook N8N
CREATE OR REPLACE FUNCTION public.notify_n8n_appointment()
RETURNS TRIGGER AS $$
DECLARE
  webhook_enabled BOOLEAN := FALSE;
BEGIN
  -- Verificar se o webhook está habilitado
  SELECT value::boolean INTO webhook_enabled
  FROM public.system_settings
  WHERE key = 'n8n_webhook_enabled'
  LIMIT 1;
  
  -- Se não estiver habilitado, sair
  IF NOT COALESCE(webhook_enabled, FALSE) THEN
    RETURN NEW;
  END IF;
  
  -- Chamar a Edge Function do N8N de forma assíncrona
  PERFORM
    net.http_post(
      url := 'https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/n8n-webhook',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
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
      )
    );
  
  -- Log da tentativa
  INSERT INTO public.system_logs (
    timestamp,
    level,
    message,
    context,
    data
  ) VALUES (
    now(),
    'info',
    'Trigger N8N webhook chamado para agendamento ' || NEW.id,
    'N8N_TRIGGER',
    jsonb_build_object(
      'agendamento_id', NEW.id,
      'paciente_nome', (SELECT nome_completo FROM public.pacientes WHERE id = NEW.paciente_id),
      'trigger_time', now()
    )
  );
  
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro mas não falha o INSERT do agendamento
    INSERT INTO public.system_logs (
      timestamp,
      level,
      message,
      context,
      data
    ) VALUES (
      now(),
      'error',
      'Erro no trigger N8N webhook: ' || SQLERRM,
      'N8N_TRIGGER_ERROR',
      jsonb_build_object(
        'agendamento_id', NEW.id,
        'error', SQLERRM,
        'sqlstate', SQLSTATE
      )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar o trigger para novos agendamentos
DROP TRIGGER IF EXISTS trigger_n8n_appointment_created ON public.agendamentos;

CREATE TRIGGER trigger_n8n_appointment_created
  AFTER INSERT ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_n8n_appointment();

-- Habilitar a extensão http se não estiver habilitada
CREATE EXTENSION IF NOT EXISTS http;