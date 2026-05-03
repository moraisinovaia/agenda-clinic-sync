-- [Sprint 7 - Operacional] Schedule cleanup automático da tabela tenant_rate_limit.
--
-- A função cleanup_rate_limit_old() já foi criada na migration
-- 20260501230100_rate_limit_persistent.sql. Este arquivo apenas adiciona o
-- pg_cron job que a chama a cada 10 minutos.
--
-- Por que 10 min:
--   - tenant_rate_limit insere 1 row por (tenant, bucket de 1min).
--   - Com 7 clínicas ativas: ~420 rows/h.
--   - Em 1 dia sem cleanup: ~10k rows. A query SUM(count) dentro de
--     increment_rate_limit cresce com a tabela.
--   - Cleanup a cada 10 min mantém apenas os últimos ~10 min de buckets
--     (janela de uso real é 60s, então 10 min é folga confortável).
--
-- Por que NÃO há cleanup pra tenant_quota_daily:
--   - Cresce 7 tenants x 365 dias = ~2.5k rows/ano (insignificante).
--   - Útil reter pra auditoria/billing histórico.
--
-- Idempotente: remove job antigo se existir antes de recriar.

DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid
  FROM cron.job
  WHERE jobname = 'llm-agent-cleanup-rate-limit';

  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'llm-agent-cleanup-rate-limit',
  '*/10 * * * *',
  $$ SELECT public.cleanup_rate_limit_old(); $$
);
