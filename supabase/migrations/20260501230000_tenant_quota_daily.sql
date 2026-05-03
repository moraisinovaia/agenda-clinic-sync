-- [Daily cost guard] Cap diário de chamadas OpenAI por tenant.
-- (Aplicado via MCP em 2026-05-01.)
CREATE TABLE IF NOT EXISTS public.tenant_quota_daily (
  cliente_id    uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  dia           date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  openai_calls  int NOT NULL DEFAULT 0,
  total_calls   int NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cliente_id, dia)
);

CREATE INDEX IF NOT EXISTS idx_tenant_quota_daily_lookup
  ON public.tenant_quota_daily (cliente_id, dia);

CREATE OR REPLACE FUNCTION public.increment_tenant_quota(
  p_cliente_id uuid,
  p_kind text DEFAULT 'openai'
)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_dia date := (now() AT TIME ZONE 'UTC')::date;
  v_openai int;
  v_total int;
BEGIN
  INSERT INTO public.tenant_quota_daily (cliente_id, dia, openai_calls, total_calls)
  VALUES (p_cliente_id, v_dia, CASE WHEN p_kind = 'openai' THEN 1 ELSE 0 END, 1)
  ON CONFLICT (cliente_id, dia) DO UPDATE SET
    openai_calls = public.tenant_quota_daily.openai_calls + (CASE WHEN p_kind = 'openai' THEN 1 ELSE 0 END),
    total_calls  = public.tenant_quota_daily.total_calls + 1,
    updated_at   = now()
  RETURNING openai_calls, total_calls INTO v_openai, v_total;
  RETURN json_build_object('cliente_id', p_cliente_id, 'dia', v_dia,
    'openai_calls', v_openai, 'total_calls', v_total);
END;
$function$;
