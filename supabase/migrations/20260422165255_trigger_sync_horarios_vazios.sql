-- Unifica e corrige os triggers de sincronização de horarios_vazios
--
-- Situação em produção antes desta migration:
--   - trigger_liberar_horario: libera slot ao cancelar (status='cancelado'/'realizado') ✅
--   - trigger_liberar_horario_edicao: libera slot antigo / ocupa novo ao remarcar data/hora ✅
--   - Faltava: INSERT (nenhum slot era marcado 'ocupado' ao criar agendamento)
--   - Faltava: excluido_em (soft-delete sem mudar status não liberava o slot)
--   - Faltava: mudança de medico_id na remarcação
--   - 236 slots dessincronizados (disponivel mas com agendamento ativo)

-- Remove triggers parciais existentes
DROP TRIGGER IF EXISTS trigger_liberar_horario ON public.agendamentos;
DROP TRIGGER IF EXISTS trigger_liberar_horario_edicao ON public.agendamentos;
DROP FUNCTION IF EXISTS public.liberar_horario_ao_cancelar();
DROP FUNCTION IF EXISTS public.liberar_horario_ao_editar();

-- Remove trigger anterior desta migration, se já foi aplicada parcialmente
DROP TRIGGER IF EXISTS trg_sync_horarios_vazios ON public.agendamentos;
DROP FUNCTION IF EXISTS public.sync_horarios_vazios_on_agendamento();

-- Trigger unificado: cobre INSERT, UPDATE (cancelar, excluir, remarcar, reativar) e DELETE
CREATE OR REPLACE FUNCTION public.sync_horarios_vazios_on_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_active BOOLEAN;
  v_new_active BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Novo agendamento ativo: ocupa o slot (se existir)
    IF NEW.status IN ('agendado', 'confirmado') AND NEW.excluido_em IS NULL THEN
      UPDATE horarios_vazios
      SET status = 'ocupado', updated_at = now()
      WHERE medico_id  = NEW.medico_id
        AND data       = NEW.data_agendamento
        AND hora       = NEW.hora_agendamento
        AND cliente_id = NEW.cliente_id
        AND status     = 'disponivel';
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_old_active := OLD.status IN ('agendado', 'confirmado') AND OLD.excluido_em IS NULL;
    v_new_active := NEW.status IN ('agendado', 'confirmado') AND NEW.excluido_em IS NULL;

    IF v_old_active AND NOT v_new_active THEN
      -- Cancelado, excluído ou inativado: libera o slot
      UPDATE horarios_vazios
      SET status = 'disponivel', updated_at = now()
      WHERE medico_id  = OLD.medico_id
        AND data       = OLD.data_agendamento
        AND hora       = OLD.hora_agendamento
        AND cliente_id = OLD.cliente_id
        AND status     = 'ocupado';

    ELSIF NOT v_old_active AND v_new_active THEN
      -- Reativado (ex: cancelamento revertido): ocupa o slot
      UPDATE horarios_vazios
      SET status = 'ocupado', updated_at = now()
      WHERE medico_id  = NEW.medico_id
        AND data       = NEW.data_agendamento
        AND hora       = NEW.hora_agendamento
        AND cliente_id = NEW.cliente_id
        AND status     = 'disponivel';

    ELSIF v_old_active AND v_new_active THEN
      -- Agendamento ativo remarcado (mudou data, hora ou médico)
      IF OLD.data_agendamento IS DISTINCT FROM NEW.data_agendamento
         OR OLD.hora_agendamento IS DISTINCT FROM NEW.hora_agendamento
         OR OLD.medico_id IS DISTINCT FROM NEW.medico_id
      THEN
        UPDATE horarios_vazios
        SET status = 'disponivel', updated_at = now()
        WHERE medico_id  = OLD.medico_id
          AND data       = OLD.data_agendamento
          AND hora       = OLD.hora_agendamento
          AND cliente_id = OLD.cliente_id
          AND status     = 'ocupado';

        UPDATE horarios_vazios
        SET status = 'ocupado', updated_at = now()
        WHERE medico_id  = NEW.medico_id
          AND data       = NEW.data_agendamento
          AND hora       = NEW.hora_agendamento
          AND cliente_id = NEW.cliente_id
          AND status     = 'disponivel';
      END IF;
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('agendado', 'confirmado') AND OLD.excluido_em IS NULL THEN
      UPDATE horarios_vazios
      SET status = 'disponivel', updated_at = now()
      WHERE medico_id  = OLD.medico_id
        AND data       = OLD.data_agendamento
        AND hora       = OLD.hora_agendamento
        AND cliente_id = OLD.cliente_id
        AND status     = 'ocupado';
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_horarios_vazios
  AFTER INSERT OR UPDATE OR DELETE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.sync_horarios_vazios_on_agendamento();

-- Correção retroativa: 236 slots que estão 'disponivel' mas têm agendamento ativo
UPDATE public.horarios_vazios hv
SET status = 'ocupado', updated_at = now()
WHERE hv.status = 'disponivel'
  AND EXISTS (
    SELECT 1 FROM public.agendamentos a
    WHERE a.medico_id        = hv.medico_id
      AND a.data_agendamento = hv.data
      AND a.hora_agendamento = hv.hora
      AND a.cliente_id       = hv.cliente_id
      AND a.status IN ('agendado', 'confirmado')
      AND a.excluido_em IS NULL
  );
