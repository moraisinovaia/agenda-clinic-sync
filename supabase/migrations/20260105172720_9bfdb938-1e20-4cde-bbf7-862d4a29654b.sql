
-- Adicionar coluna updated_at na tabela medicos que está faltando
ALTER TABLE medicos 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now();
