-- Limpeza completa dos dados de teste para implementação na clínica
-- Preserva configurações e estruturas, remove apenas dados transacionais

-- 1. Limpar notificações da fila de espera
DELETE FROM public.fila_notificacoes;

-- 2. Limpar fila de espera
DELETE FROM public.fila_espera;

-- 3. Limpar auditoria de agendamentos
DELETE FROM public.agendamentos_audit;

-- 4. Limpar todos os agendamentos
DELETE FROM public.agendamentos;

-- 5. Limpar todos os pacientes
DELETE FROM public.pacientes;

-- Log da limpeza
INSERT INTO public.system_logs (
  timestamp,
  level,
  message,
  context
) VALUES (
  now(),
  'info',
  'Limpeza completa de dados de teste executada - Sistema pronto para produção',
  'PRODUCTION_CLEANUP'
);

-- Verificação final - resetar sequences se necessário
-- (Para garantir que novos IDs comecem do 1)
SELECT setval(pg_get_serial_sequence('clinica_valores', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('valores_procedimentos', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('n8n_chat_histories', 'id'), 1, false);