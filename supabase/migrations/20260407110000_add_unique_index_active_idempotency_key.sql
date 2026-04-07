-- Unicidade semântica de idempotency_key em agendamentos ativos.
-- Garante que dois INSERTs concorrentes com a mesma chave não resultem em duplicata —
-- o segundo falha com violação de unicidade, independentemente de retry ou workers paralelos.
-- O filtro parcial (status ativo + não excluído) permite reutilizar a mesma chave
-- após cancelamento ou exclusão, o que é o comportamento correto de idempotência.

CREATE UNIQUE INDEX IF NOT EXISTS idx_agendamentos_active_idempotency_key
  ON public.agendamentos (idempotency_key)
  WHERE idempotency_key IS NOT NULL
    AND status IN ('agendado', 'confirmado')
    AND excluido_em IS NULL
    AND cancelado_em IS NULL;
