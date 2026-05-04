-- [Sprint 7 — Bug fix retroativo] GRANTs faltantes pra service_role.
--
-- Diagnóstico (2026-05-04):
--   Migrations 20260501210454 (api_keys), 20260501230000 (tenant_quota_daily)
--   e 20260501230100 (rate_limit_persistent) foram aplicadas via MCP sem
--   incluir os GRANTs padrão Supabase. Tabelas criadas via dashboard pegam
--   grants automáticos; via SQL puro precisa adicionar manualmente.
--
--   Resultado em produção:
--   - auth.ts:resolveAuth → permission denied silencioso ao consultar api_keys
--     → cai SEMPRE no fallback legacy N8N_API_KEY → tenant_key auth nunca
--     funcionou desde a migration de api_keys
--   - rate-limit.ts → fail-open silencioso (RPC erra, retorna allowed=true)
--   - quota.ts (cost guard) → mesma coisa (fail-open silencioso)
--
--   Dr. Marcelo segue funcionando porque usa N8N_API_KEY legacy e RPCs
--   SECURITY DEFINER (criar_agendamento_atomico_externo etc) bypassam GRANTs.
--   Mas Sprint 7 hardening estava parcialmente teatro.
--
-- Esta migration restaura os GRANTs default Supabase nessas tabelas, sem
-- alterar nenhum dado. Reversível via REVOKE.

-- Auth multi-tenant (api_keys)
GRANT SELECT, UPDATE ON public.api_keys TO service_role;
GRANT SELECT, UPDATE ON public.api_keys TO authenticated;

-- Lookups de tenant
GRANT SELECT ON public.clientes TO service_role;

-- Sprint 7 — rate limit cross-instance autoritativo
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_rate_limit TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_rate_limit TO authenticated;

-- Sprint 7 — daily cost guard
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_quota_daily TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_quota_daily TO authenticated;

-- Auditoria (escrita pelo middleware em mutações sensíveis)
GRANT SELECT, INSERT ON public.audit_logs TO service_role;

-- Fluxo de confirmação automática (lembretes 24h antes)
GRANT SELECT, INSERT, UPDATE ON public.confirmacoes_automaticas TO service_role;
