-- Atualizar usuário teste para cliente IPADO
UPDATE public.profiles 
SET cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
    updated_at = now()
WHERE email = 'teste@exemplo.com';

-- Log da correção
INSERT INTO public.system_logs (
  timestamp, level, message, context
) VALUES (
  now(), 'info', 
  'Usuário teste@exemplo.com movido do cliente INOVAIA para IPADO',
  'USER_CLIENT_CORRECTION'
);