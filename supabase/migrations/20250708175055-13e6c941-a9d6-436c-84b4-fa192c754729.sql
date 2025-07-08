-- Remover todas as políticas RLS das tabelas problemáticas
DROP POLICY IF EXISTS "Enable read access for all users" ON agendamentos;
DROP POLICY IF EXISTS "Enable insert access for all users" ON agendamentos;
DROP POLICY IF EXISTS "Enable update access for all users" ON agendamentos;
DROP POLICY IF EXISTS "Enable delete access for all users" ON agendamentos;

DROP POLICY IF EXISTS "Allow all operations on pacientes" ON pacientes;

-- Verificar e garantir que não há outras políticas
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Remover todas as políticas da tabela agendamentos
    FOR policy_record IN 
        SELECT polname FROM pg_policy WHERE polrelid = 'public.agendamentos'::regclass
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.polname || '" ON agendamentos';
    END LOOP;
    
    -- Remover todas as políticas da tabela pacientes
    FOR policy_record IN 
        SELECT polname FROM pg_policy WHERE polrelid = 'public.pacientes'::regclass
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.polname || '" ON pacientes';
    END LOOP;
END $$;