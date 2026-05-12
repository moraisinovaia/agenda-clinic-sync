-- Estende n8n_status_atendimento com colunas pro state do llm-agent-api.
--
-- O /chat retorna a cada turno: novo_estado, dados_coletados, historico_contexto.
-- O workflow n8n precisa persistir esses 3 campos por (session_id, cliente_id)
-- pra reenviar no próximo turno e manter a conversa contínua.
--
-- Mantém colunas existentes (lock_conversa, modo_atendimento, etc) — usadas
-- pela infra de transbordo Chatwoot quando virar humano.
--
-- session_id é o telefone do paciente (formato Evolution: 55879XXXXXXXX@s.whatsapp.net
-- ou apenas DDD+número — workflow normaliza antes de gravar).

ALTER TABLE public.n8n_status_atendimento
  ADD COLUMN IF NOT EXISTS estado_atual       text  NOT NULL DEFAULT 'inicio',
  ADD COLUMN IF NOT EXISTS dados_coletados    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS historico_contexto jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS config_id          uuid;

-- Garante unicidade por (session_id, cliente_id) para upsert seguro do n8n
CREATE UNIQUE INDEX IF NOT EXISTS uniq_n8n_status_atendimento_session_cliente
  ON public.n8n_status_atendimento (session_id, cliente_id);

-- Index pra filtros operacionais (encontrar conversas ativas por cliente)
CREATE INDEX IF NOT EXISTS idx_n8n_status_atendimento_cliente_updated
  ON public.n8n_status_atendimento (cliente_id, updated_at DESC);
