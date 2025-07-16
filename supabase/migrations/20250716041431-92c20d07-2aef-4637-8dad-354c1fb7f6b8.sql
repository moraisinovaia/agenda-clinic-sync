-- Remover completamente o trigger de auditoria para permitir que o N8N funcione
DROP TRIGGER IF EXISTS agendamentos_audit_trigger ON agendamentos;

-- Comentário: O trigger de auditoria foi removido temporariamente para permitir
-- que o N8N crie agendamentos. Pode ser reativado posteriormente se necessário,
-- mas deve ser modificado para não depender da autenticação Supabase.