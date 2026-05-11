-- [Override profissional - Fase 1.1] Colunas pra agendamentos forçados.
--
-- Quando recepção precisa marcar fora da regra (encaixe, emergência, VIP),
-- as colunas abaixo registram o motivo e quem autorizou pra trilha LGPD.

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS force_motivo_categoria text,
  ADD COLUMN IF NOT EXISTS force_reason text,
  ADD COLUMN IF NOT EXISTS forced_at timestamptz,
  ADD COLUMN IF NOT EXISTS forced_by_user_id uuid REFERENCES auth.users(id);

ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_force_motivo_categoria_chk;
ALTER TABLE public.agendamentos
  ADD CONSTRAINT agendamentos_force_motivo_categoria_chk
  CHECK (force_motivo_categoria IS NULL OR force_motivo_categoria IN ('encaixe','emergencia','paciente_vip','outro'));

ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_force_outro_requires_reason_chk;
ALTER TABLE public.agendamentos
  ADD CONSTRAINT agendamentos_force_outro_requires_reason_chk
  CHECK (
    force_motivo_categoria IS DISTINCT FROM 'outro'
    OR (force_reason IS NOT NULL AND length(btrim(force_reason)) >= 5)
  );

ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_forced_requires_metadata_chk;
ALTER TABLE public.agendamentos
  ADD CONSTRAINT agendamentos_forced_requires_metadata_chk
  CHECK (
    forced_at IS NULL
    OR (force_motivo_categoria IS NOT NULL AND forced_by_user_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_agendamentos_forced
  ON public.agendamentos (cliente_id, forced_at)
  WHERE forced_at IS NOT NULL;

-- Trigger de auditoria
CREATE OR REPLACE FUNCTION public.audit_agendamento_forcado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.force_motivo_categoria IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.force_motivo_categoria IS DISTINCT FROM NEW.force_motivo_categoria) THEN
    INSERT INTO public.audit_logs (
      audit_timestamp, user_id, action, table_name, record_id, new_values, cliente_id
    ) VALUES (
      now(), NEW.forced_by_user_id, 'agendamento_forcado', 'agendamentos', NEW.id,
      jsonb_build_object(
        'categoria', NEW.force_motivo_categoria,
        'motivo', NEW.force_reason,
        'forced_at', NEW.forced_at,
        'medico_id', NEW.medico_id,
        'atendimento_id', NEW.atendimento_id,
        'data', NEW.data_agendamento,
        'hora', NEW.hora_agendamento
      ),
      NEW.cliente_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agendamento_forcado_audit ON public.agendamentos;
CREATE TRIGGER agendamento_forcado_audit
  AFTER INSERT OR UPDATE OF force_motivo_categoria ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.audit_agendamento_forcado();
