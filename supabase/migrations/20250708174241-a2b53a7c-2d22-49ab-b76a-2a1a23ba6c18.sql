-- Corrigir políticas RLS da tabela agendamentos
-- Primeiro, remover a política existente
DROP POLICY IF EXISTS "Allow all operations on agendamentos" ON agendamentos;

-- Criar políticas mais específicas e permissivas
CREATE POLICY "Enable read access for all users" ON agendamentos
FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON agendamentos
FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON agendamentos
FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete access for all users" ON agendamentos
FOR DELETE USING (true);