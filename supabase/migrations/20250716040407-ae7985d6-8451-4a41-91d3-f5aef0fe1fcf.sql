-- Alterar tipo da coluna changed_by para text
ALTER TABLE agendamentos_audit 
ALTER COLUMN changed_by TYPE TEXT;