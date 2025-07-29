-- Verificar as constraints da tabela agendamentos
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'public.agendamentos'::regclass;