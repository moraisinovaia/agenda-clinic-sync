-- [Etapa F] Tinha 2 índices UNIQUE idênticos em idempotency_key:
--   - idx_agendamentos_idempotency
--   - idx_agendamentos_active_idempotency_key
-- Drop o redundante. Mantém o de nome mais antigo/curto.
DROP INDEX IF EXISTS public.idx_agendamentos_active_idempotency_key;
