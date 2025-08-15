-- Atualizar URL do webhook N8N para a URL fornecida pelo usuário
UPDATE public.system_settings 
SET value = 'https://n8n.inovaia.online/webhook-test/whatsapp-webhook',
    updated_at = now()
WHERE key = 'n8n_webhook_url';

-- Verificar se a configuração foi atualizada
INSERT INTO public.system_logs (
  timestamp,
  level,
  message,
  context,
  data
) VALUES (
  now(),
  'info',
  'URL do webhook N8N atualizada',
  'N8N_CONFIG',
  jsonb_build_object(
    'nova_url', 'https://n8n.inovaia.online/webhook-test/whatsapp-webhook',
    'atualizado_por', 'admin'
  )
);