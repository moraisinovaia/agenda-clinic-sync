-- Criar política para permitir inserções na tabela de auditoria
-- Isso é necessário para que o N8N (não autenticado) possa fazer auditorias
CREATE POLICY "audit_insert_all" ON agendamentos_audit
FOR INSERT 
WITH CHECK (true);

-- Permitir updates também caso necessário
CREATE POLICY "audit_update_all" ON agendamentos_audit
FOR UPDATE 
USING (true)
WITH CHECK (true);