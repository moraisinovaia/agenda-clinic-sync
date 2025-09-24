-- Corrigir cliente_id null do usuário atual para permitir agendamentos
-- Associar usuário wislannyvitoria2@gmail.com à clínica INOVAIA (ID corrigido)

UPDATE public.profiles 
SET cliente_id = '0a77ac7c-b0dc-4945-bf62-b2dec26d6df1'  -- INOVAIA (ID correto)
WHERE email = 'wislannyvitoria2@gmail.com' 
  AND cliente_id IS NULL;

-- Log da correção
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info', 
  'Usuário associado à clínica INOVAIA para corrigir agendamentos',
  'USER_CLINIC_ASSOCIATION_FIX',
  jsonb_build_object(
    'user_email', 'wislannyvitoria2@gmail.com',
    'cliente_id', '0a77ac7c-b0dc-4945-bf62-b2dec26d6df1',
    'cliente_nome', 'INOVAIA'
  )
);