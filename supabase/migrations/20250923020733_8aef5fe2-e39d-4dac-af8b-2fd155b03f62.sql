-- Add default configurations for existing clients
INSERT INTO public.client_configurations (cliente_id, category, key, value, description)
SELECT 
  id,
  'interface',
  'theme_color',
  '#0ea5e9',
  'Cor principal da interface'
FROM public.clientes 
WHERE ativo = true
ON CONFLICT (cliente_id, category, key) DO NOTHING;

INSERT INTO public.client_configurations (cliente_id, category, key, value, description)
SELECT 
  id,
  'scheduling',
  'max_appointments_per_day',
  '40',
  'Máximo de agendamentos por médico por dia'
FROM public.clientes 
WHERE ativo = true
ON CONFLICT (cliente_id, category, key) DO NOTHING;

INSERT INTO public.client_configurations (cliente_id, category, key, value, description)
SELECT 
  id,
  'notifications',
  'whatsapp_enabled',
  'true',
  'Habilitar notificações via WhatsApp'
FROM public.clientes 
WHERE ativo = true
ON CONFLICT (cliente_id, category, key) DO NOTHING;

-- Initialize metrics for today
SELECT public.update_client_metrics();