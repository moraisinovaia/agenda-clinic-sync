-- [Painel médico - Fase 1.4] Trigger de auditoria em user_medico_access.
--
-- Toda mudança em assignments (criar, revogar, reativar, alterar motivo) gera
-- linha em audit_logs pra trilha LGPD. Permite responder a perguntas como:
--   - Quem deu acesso ao usuário X pra ver agenda do médico Y?
--   - Quando foi revogado?
--   - Quem fez a revogação?
--
-- Não loga DELETE porque a tabela não permite DELETE via RLS (só revogação
-- soft via ativo=false). Operações via service_role/postgres ignoram trigger
-- se desligado, mas pra esse caso (ferramenta de manutenção) é aceitável.

CREATE OR REPLACE FUNCTION public.audit_user_medico_access_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'assignment_concedido';
    v_old := NULL;
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.ativo = true AND NEW.ativo = false THEN
      v_action := 'assignment_revogado';
    ELSIF OLD.ativo = false AND NEW.ativo = true THEN
      v_action := 'assignment_reativado';
    ELSE
      v_action := 'assignment_atualizado';
    END IF;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  ELSE
    RETURN NEW;  -- não logamos DELETE (revogação é UPDATE com ativo=false)
  END IF;

  INSERT INTO public.audit_logs (
    audit_timestamp, user_id, action, table_name, record_id,
    old_values, new_values, cliente_id
  ) VALUES (
    now(),
    auth.uid(),
    v_action,
    'user_medico_access',
    COALESCE(NEW.id, OLD.id),
    v_old,
    v_new,
    COALESCE(NEW.cliente_id, OLD.cliente_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_medico_access_audit ON public.user_medico_access;
CREATE TRIGGER user_medico_access_audit
  AFTER INSERT OR UPDATE ON public.user_medico_access
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_medico_access_trigger();

COMMENT ON FUNCTION public.audit_user_medico_access_trigger IS
  'Loga toda mudança em user_medico_access em audit_logs (compliance LGPD). Action: assignment_concedido/revogado/reativado/atualizado.';
