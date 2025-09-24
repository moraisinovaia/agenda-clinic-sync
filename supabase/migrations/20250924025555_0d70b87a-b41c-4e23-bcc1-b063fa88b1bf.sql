-- Associar usuário à clínica IPADO para permitir agendamentos com médicos corretos
-- O usuário estava associado à INOVAIA, mas os médicos que aparecem são da IPADO

UPDATE public.profiles 
SET cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054'  -- IPADO
WHERE email = 'wislannyvitoria2@gmail.com';

-- Log da alteração
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info', 
  'Usuário movido de INOVAIA para IPADO para corrigir acesso aos médicos',
  'USER_CLINIC_CHANGE',
  jsonb_build_object(
    'user_email', 'wislannyvitoria2@gmail.com',
    'cliente_id_anterior', '0a77ac7c-b0dc-4945-bf62-b2dec26d6df1',
    'cliente_id_novo', '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
    'cliente_nome', 'IPADO'
  )
);