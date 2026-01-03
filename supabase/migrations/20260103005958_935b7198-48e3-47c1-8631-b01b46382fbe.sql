-- Adicionar colunas faltantes na tabela medicos
ALTER TABLE public.medicos ADD COLUMN IF NOT EXISTS telefone_alternativo varchar(50);
ALTER TABLE public.medicos ADD COLUMN IF NOT EXISTS atende_criancas boolean DEFAULT true;
ALTER TABLE public.medicos ADD COLUMN IF NOT EXISTS atende_adultos boolean DEFAULT true;