-- Tornar o campo telefone opcional (nullable)
ALTER TABLE public.pacientes 
ALTER COLUMN telefone DROP NOT NULL;