-- ============================================================
-- Backfill horarios_vazios + criar triggers faltantes
-- Projeto: qxlvzbvzajibdtlzngdy
-- ============================================================

-- 1) BACKFILL: marcar como 'ocupado' todo slot que tem agendamento ativo
--    e inserir slots faltantes para agendamentos ativos sem registro em horarios_vazios

-- 1a) Atualiza slots existentes que estão dessincronizados
UPDATE public.horarios_vazios hv
SET status = 'ocupado',
    updated_at = now()
FROM public.agendamentos a
WHERE a.medico_id = hv.medico_id
  AND a.data_agendamento = hv.data
  AND a.hora_agendamento = hv.hora
  AND a.cliente_id = hv.cliente_id
  AND a.status IN ('agendado', 'confirmado')
  AND a.excluido_em IS NULL
  AND hv.status <> 'ocupado';

-- 1b) Insere slots ausentes para agendamentos ativos
INSERT INTO public.horarios_vazios (medico_id, data, hora, cliente_id, status, created_at, updated_at)
SELECT DISTINCT a.medico_id, a.data_agendamento, a.hora_agendamento, a.cliente_id, 'ocupado', now(), now()
FROM public.agendamentos a
WHERE a.status IN ('agendado', 'confirmado')
  AND a.excluido_em IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.horarios_vazios hv
    WHERE hv.medico_id = a.medico_id
      AND hv.data = a.data_agendamento
      AND hv.hora = a.hora_agendamento
      AND hv.cliente_id = a.cliente_id
  );

-- 1c) Libera slots cujo agendamento foi cancelado/excluído (para corrigir falsos 'ocupado')
UPDATE public.horarios_vazios hv
SET status = 'disponivel',
    updated_at = now()
WHERE hv.status = 'ocupado'
  AND NOT EXISTS (
    SELECT 1 FROM public.agendamentos a
    WHERE a.medico_id = hv.medico_id
      AND a.data_agendamento = hv.data
      AND a.hora_agendamento = hv.hora
      AND a.cliente_id = hv.cliente_id
      AND a.status IN ('agendado', 'confirmado')
      AND a.excluido_em IS NULL
  );

-- 2) FUNÇÃO DO TRIGGER (idempotente, cobre INSERT/UPDATE/DELETE)
CREATE OR REPLACE FUNCTION public.sync_horarios_vazios_from_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_active boolean := false;
  v_new_active boolean := false;
BEGIN
  -- Determina se o estado anterior representava slot ocupado
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old_active := (OLD.status IN ('agendado','confirmado') AND OLD.excluido_em IS NULL);
  END IF;

  -- Determina se o estado novo representa slot ocupado
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new_active := (NEW.status IN ('agendado','confirmado') AND NEW.excluido_em IS NULL);
  END IF;

  -- Caso DELETE ou virou inativo: liberar slot antigo (se nenhum outro agendamento ativo o ocupar)
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND v_old_active AND NOT v_new_active) THEN
    UPDATE public.horarios_vazios hv
    SET status = 'disponivel', updated_at = now()
    WHERE hv.medico_id = OLD.medico_id
      AND hv.data = OLD.data_agendamento
      AND hv.hora = OLD.hora_agendamento
      AND hv.cliente_id = OLD.cliente_id
      AND NOT EXISTS (
        SELECT 1 FROM public.agendamentos a
        WHERE a.medico_id = OLD.medico_id
          AND a.data_agendamento = OLD.data_agendamento
          AND a.hora_agendamento = OLD.hora_agendamento
          AND a.cliente_id = OLD.cliente_id
          AND a.status IN ('agendado','confirmado')
          AND a.excluido_em IS NULL
          AND (TG_OP = 'DELETE' OR a.id <> NEW.id)
      );
  END IF;

  -- Caso UPDATE alterou data/hora/medico mantendo ativo: liberar slot antigo
  IF TG_OP = 'UPDATE' AND v_old_active AND v_new_active AND
     (OLD.medico_id <> NEW.medico_id
      OR OLD.data_agendamento <> NEW.data_agendamento
      OR OLD.hora_agendamento <> NEW.hora_agendamento) THEN
    UPDATE public.horarios_vazios hv
    SET status = 'disponivel', updated_at = now()
    WHERE hv.medico_id = OLD.medico_id
      AND hv.data = OLD.data_agendamento
      AND hv.hora = OLD.hora_agendamento
      AND hv.cliente_id = OLD.cliente_id
      AND NOT EXISTS (
        SELECT 1 FROM public.agendamentos a
        WHERE a.medico_id = OLD.medico_id
          AND a.data_agendamento = OLD.data_agendamento
          AND a.hora_agendamento = OLD.hora_agendamento
          AND a.cliente_id = OLD.cliente_id
          AND a.status IN ('agendado','confirmado')
          AND a.excluido_em IS NULL
          AND a.id <> NEW.id
      );
  END IF;

  -- Caso INSERT/UPDATE virou ativo: marcar slot novo como ocupado (upsert)
  IF v_new_active THEN
    INSERT INTO public.horarios_vazios (medico_id, data, hora, cliente_id, status, created_at, updated_at)
    VALUES (NEW.medico_id, NEW.data_agendamento, NEW.hora_agendamento, NEW.cliente_id, 'ocupado', now(), now())
    ON CONFLICT (medico_id, data, hora, cliente_id) DO UPDATE
      SET status = 'ocupado', updated_at = now();
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3) Garantir índice único para o ON CONFLICT funcionar
CREATE UNIQUE INDEX IF NOT EXISTS horarios_vazios_unique_slot
  ON public.horarios_vazios (medico_id, data, hora, cliente_id);

-- 4) Recriar os 3 triggers (INSERT, UPDATE, DELETE)
DROP TRIGGER IF EXISTS trg_sync_horarios_vazios_ins ON public.agendamentos;
DROP TRIGGER IF EXISTS trg_sync_horarios_vazios_upd ON public.agendamentos;
DROP TRIGGER IF EXISTS trg_sync_horarios_vazios_del ON public.agendamentos;

CREATE TRIGGER trg_sync_horarios_vazios_ins
  AFTER INSERT ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.sync_horarios_vazios_from_agendamento();

CREATE TRIGGER trg_sync_horarios_vazios_upd
  AFTER UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.sync_horarios_vazios_from_agendamento();

CREATE TRIGGER trg_sync_horarios_vazios_del
  AFTER DELETE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.sync_horarios_vazios_from_agendamento();