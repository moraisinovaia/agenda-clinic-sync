-- [H3] Rate limit persistente cross-instance via Postgres.
-- (Aplicado via MCP em 2026-05-01.)
CREATE TABLE IF NOT EXISTS public.tenant_rate_limit (
  cliente_id  uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  bucket_min  timestamptz NOT NULL,
  count       int NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cliente_id, bucket_min)
);

CREATE INDEX IF NOT EXISTS idx_tenant_rate_limit_old
  ON public.tenant_rate_limit (bucket_min);

CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_cliente_id uuid,
  p_window_seconds int DEFAULT 60
)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
  v_bucket timestamptz := date_trunc('minute', v_now);
  v_count int;
  v_window_count int;
BEGIN
  INSERT INTO public.tenant_rate_limit (cliente_id, bucket_min, count)
  VALUES (p_cliente_id, v_bucket, 1)
  ON CONFLICT (cliente_id, bucket_min) DO UPDATE SET
    count = public.tenant_rate_limit.count + 1, updated_at = now()
  RETURNING count INTO v_count;

  SELECT COALESCE(SUM(count), 0) INTO v_window_count
  FROM public.tenant_rate_limit
  WHERE cliente_id = p_cliente_id
    AND bucket_min >= v_now - (p_window_seconds || ' seconds')::interval;

  RETURN json_build_object('cliente_id', p_cliente_id, 'bucket_min', v_bucket,
    'count_bucket', v_count, 'count_window', v_window_count, 'window_seconds', p_window_seconds);
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_old() RETURNS int LANGUAGE sql AS $function$
  DELETE FROM public.tenant_rate_limit WHERE bucket_min < now() - interval '10 minutes' RETURNING 1;
$function$;
