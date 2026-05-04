-- [F1.1] Tabela de API keys por tenant. Resolve auth multi-tenant: a key
-- vem com cliente_id embutido. O middleware valida que body.cliente_id ===
-- api_key.cliente_id. Sem isso, qualquer holder do N8N_API_KEY global podia
-- chamar com qualquer cliente_id e ler dados de outros tenants.
CREATE TABLE IF NOT EXISTS public.api_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  key_hash      text NOT NULL,
  label         text,
  ativo         boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash_lookup
  ON public.api_keys (key_hash)
  WHERE ativo = true AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_api_keys_cliente
  ON public.api_keys (cliente_id, ativo);

COMMENT ON TABLE public.api_keys IS
  'API keys por tenant. cliente_id resolvido pela key, body.cliente_id deve bater. Service-role only.';
COMMENT ON COLUMN public.api_keys.key_hash IS
  'SHA-256 hex da raw key. Raw key NÃO é armazenada — gerar com `openssl rand -hex 32` ou _tests/scripts/generate-api-key.ts.';
