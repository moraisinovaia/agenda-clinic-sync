-- Backfill: marca como 'ocupado' os slots de horarios_vazios que já têm
-- agendamento ativo mas estavam dessincronizados (status='disponivel').
--
-- O trigger trg_sync_horarios_vazios (migration 20260422165255) cobre novos
-- eventos a partir de agora. Esta migration corrige o histórico pré-trigger.
--
-- Idempotente: WHERE status='disponivel' garante que re-execuções são no-op.

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
