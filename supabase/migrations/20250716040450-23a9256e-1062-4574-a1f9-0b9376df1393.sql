-- Primeiro remover a constraint foreign key
ALTER TABLE agendamentos_audit 
DROP CONSTRAINT IF EXISTS agendamentos_audit_changed_by_fkey;

-- Alterar o tipo da coluna changed_by para text
ALTER TABLE agendamentos_audit 
ALTER COLUMN changed_by TYPE TEXT;