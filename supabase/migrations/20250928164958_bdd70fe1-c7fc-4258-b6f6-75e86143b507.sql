-- Alterar a tabela pacientes para permitir data_nascimento NULL
ALTER TABLE public.pacientes 
ALTER COLUMN data_nascimento DROP NOT NULL;