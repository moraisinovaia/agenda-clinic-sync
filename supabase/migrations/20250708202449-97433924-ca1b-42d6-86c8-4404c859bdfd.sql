-- Adicionar campo celular na tabela pacientes
ALTER TABLE public.pacientes 
ADD COLUMN celular character varying NOT NULL DEFAULT '';