-- 🔒 TORNAR CLIENTE_ID OBRIGATÓRIO NAS TABELAS CORE

ALTER TABLE public.pacientes
ALTER COLUMN cliente_id SET NOT NULL;

ALTER TABLE public.agendamentos
ALTER COLUMN cliente_id SET NOT NULL;

ALTER TABLE public.fila_espera
ALTER COLUMN cliente_id SET NOT NULL;

ALTER TABLE public.fila_notificacoes
ALTER COLUMN cliente_id SET NOT NULL;