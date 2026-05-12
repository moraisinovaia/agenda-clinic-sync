-- Hardening pre go-live do n8n + WhatsApp:
--
--   1) Habilita RLS em n8n_status_atendimento (advisor security ERROR — única
--      tabela do hot-path do llm-agent ainda sem RLS). Após o agente ativar,
--      essa tabela vai guardar conversas inteiras com PII (nome, telefone,
--      convênio, sintomas etc) — qualquer anon-key conseguiria ler tudo.
--
--   2) Drop do duplicate index uniq_n8n_status_atendimento_session_cliente
--      (criado na migration 20260511170000 sem checar que session_id_cliente_id_key
--      já existia desde a criação da tabela). Mantém o UNIQUE existente.
--
--   3) SET search_path = public, pg_temp nas 5 functions com search_path
--      mutável apontadas pelo advisor (validar_limite_recurso e auxiliares).
--      Mitiga risco de schema-spoofing.

-- ── 1) RLS n8n_status_atendimento ─────────────────────────────────────────
ALTER TABLE public.n8n_status_atendimento ENABLE ROW LEVEL SECURITY;

-- Política única: só service_role lê/escreve.
-- O workflow n8n usa Postgres credential autenticada como service_role
-- (não anon). LLM-agent-api roda como service_role no edge function.
DROP POLICY IF EXISTS "service_role_full_access" ON public.n8n_status_atendimento;
CREATE POLICY "service_role_full_access" ON public.n8n_status_atendimento
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Bloqueia explicitamente anon e authenticated.
DROP POLICY IF EXISTS "deny_anon" ON public.n8n_status_atendimento;
CREATE POLICY "deny_anon" ON public.n8n_status_atendimento
  FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "deny_authenticated" ON public.n8n_status_atendimento;
CREATE POLICY "deny_authenticated" ON public.n8n_status_atendimento
  FOR ALL TO authenticated USING (false);

-- ── 2) Drop duplicate index ───────────────────────────────────────────────
-- session_id_cliente_id_key (UNIQUE constraint original) cobre o mesmo par.
DROP INDEX IF EXISTS public.uniq_n8n_status_atendimento_session_cliente;

-- ── 3) SET search_path nas RPCs vulneráveis ───────────────────────────────
-- Lista do advisor function_search_path_mutable. Mitigação leve mas zera os warns.
DO $$
DECLARE
  fn_name text;
  fn_signature text;
BEGIN
  FOR fn_name, fn_signature IN
    SELECT p.proname,
           p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'validar_limite_recurso',
        '_username_from_medico_nome',
        'cleanup_rate_limit_old',
        'gerar_idempotency_key',
        'get_clinic_runtime_context'
      )
      AND NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) AS c
        WHERE c LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION public.%s SET search_path = public, pg_temp', fn_signature);
    RAISE NOTICE 'search_path set on public.%', fn_signature;
  END LOOP;
END $$;
