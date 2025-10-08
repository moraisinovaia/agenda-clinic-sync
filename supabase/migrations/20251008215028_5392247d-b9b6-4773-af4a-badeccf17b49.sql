-- Corrigir cliente_id da configuração de teste da Dra. Adriana
-- Atualizar de IPADO para o cliente correto do usuário logado

UPDATE public.horarios_configuracao
SET cliente_id = '0a77ac7c-b0dc-4945-bf62-b2dec26d6df1'
WHERE medico_id = '32d30887-b876-4502-bf04-e55d7fb55b50'
  AND dia_semana = 4
  AND periodo = 'manha'
  AND cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';

-- Log da correção
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 
  'info',
  '[FIX] Cliente_id da configuração de teste corrigido',
  'SCHEDULE_CONFIG_FIX',
  jsonb_build_object(
    'medico', 'Dra. Adriana Carla de Sena',
    'cliente_id_antigo', '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
    'cliente_id_novo', '0a77ac7c-b0dc-4945-bf62-b2dec26d6df1',
    'motivo', 'Corrigir incompatibilidade RLS'
  )
);