-- Primeiro, vamos ver quais constraints existem na tabela agendamentos
SELECT constraint_name, constraint_type, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%agendamentos%';

-- Vamos também ver a definição da tabela
SELECT column_name, data_type, column_default, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'agendamentos' 
AND table_schema = 'public';

-- Verificar se há alguma constraint específica no campo criado_por
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'public.agendamentos'::regclass;