
-- Migration: Corrigir notify_n8n_appointment_created
-- Remover fallback de anon_key hardcoded (usar apenas current_setting)
-- NOTA: anon_key é pública e pode estar no código, mas é melhor usar configurações

CREATE OR REPLACE FUNCTION public.notify_n8n_appointment_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  webhook_enabled BOOLEAN := false;
  supabase_url TEXT;
  anon_key TEXT;
  webhook_url TEXT;
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

  -- Buscar configurações do sistema (sem fallback hardcoded)
  SELECT value INTO supabase_url 
  FROM public.system_settings 
  WHERE key = 'supabase_url'
  LIMIT 1;
  
  SELECT value INTO anon_key 
  FROM public.system_settings 
  WHERE key = 'supabase_anon_key'
  LIMIT 1;

  -- Se não encontrar as configurações, logar e sair
  IF supabase_url IS NULL OR supabase_url = '' OR anon_key IS NULL OR anon_key = '' THEN
    INSERT INTO public.system_logs (
      timestamp, level, message, context, data
    ) VALUES (
      now(), 'warn', 
      'Configurações do Supabase não encontradas, webhook não enviado',
      'N8N_TRIGGER_CONFIG_MISSING',
      jsonb_build_object('agendamento_id', NEW.id)
    );
    RETURN NEW;
  END IF;

  -- Executar chamada HTTP para a Edge Function
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
      INSERT INTO public.system_logs (
        timestamp, level, message, context, data
      ) VALUES (
        now(), 'error', 
        'Erro ao chamar n8n-webhook: ' || SQLERRM,
        'N8N_TRIGGER_ERROR',
        jsonb_build_object(
          'agendamento_id', NEW.id,
          'error', SQLERRM
        )
      );
  END;

  RETURN NEW;
END;
$$;

-- Adicionar configurações necessárias (se não existirem)
INSERT INTO public.system_settings (key, value, description, created_at, updated_at)
VALUES 
  ('supabase_url', 'https://qxlvzbvzajibdtlzngdy.supabase.co', 'URL do projeto Supabase', now(), now()),
  ('supabase_anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MDg5MzMsImV4cCI6MjA2NjA4NDkzM30.iLhYwcxvF-2wBe3uWllrxMItGpQ09OA8c8_7VMlRDw8', 'Chave pública (anon) do Supabase', now(), now())
ON CONFLICT (key) DO NOTHING;
