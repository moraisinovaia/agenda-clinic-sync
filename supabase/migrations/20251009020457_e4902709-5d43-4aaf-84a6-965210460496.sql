-- Transformar o usuário IRYS rejeitado em pendente novamente
-- para que apareça no painel de aprovação

UPDATE public.profiles
SET 
  status = 'pendente',
  updated_at = now()
WHERE email = 'moraisinovaiacloud@gmail.com'
AND status = 'rejeitado';

-- Log da mudança
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info',
  '[ADMIN] Usuário IRYS reativado para aprovação',
  'USER_STATUS_CHANGE',
  jsonb_build_object(
    'email', 'moraisinovaiacloud@gmail.com',
    'old_status', 'rejeitado',
    'new_status', 'pendente',
    'reason', 'Reativação manual para nova avaliação'
  )
);