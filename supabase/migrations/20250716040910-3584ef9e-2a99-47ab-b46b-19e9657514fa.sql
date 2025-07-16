-- Remover o trigger de auditoria atual
DROP TRIGGER IF EXISTS agendamentos_audit_trigger ON agendamentos;

-- Criar uma função de auditoria mais robusta que funciona com e sem autenticação
CREATE OR REPLACE FUNCTION public.audit_agendamentos()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  current_user_id TEXT;
BEGIN
  -- Tentar obter o usuário autenticado, senão usar 'system'
  BEGIN
    SELECT COALESCE(auth.uid()::text, 'system') INTO current_user_id;
  EXCEPTION
    WHEN OTHERS THEN
      current_user_id := 'system';
  END;
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.agendamentos_audit (agendamento_id, action, new_data, changed_by)
    VALUES (NEW.id, 'INSERT', to_jsonb(NEW), current_user_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.agendamentos_audit (agendamento_id, action, old_data, new_data, changed_by)
    VALUES (NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), current_user_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.agendamentos_audit (agendamento_id, action, old_data, changed_by)
    VALUES (OLD.id, 'DELETE', to_jsonb(OLD), current_user_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- Recriar o trigger
CREATE TRIGGER agendamentos_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION audit_agendamentos();