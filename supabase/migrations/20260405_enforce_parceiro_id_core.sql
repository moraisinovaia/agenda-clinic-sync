-- 🔒 TORNAR parceiro_id OBRIGATÓRIO EM clientes E profiles

ALTER TABLE public.clientes
ALTER COLUMN parceiro_id SET NOT NULL;

ALTER TABLE public.profiles
ALTER COLUMN parceiro_id SET NOT NULL;