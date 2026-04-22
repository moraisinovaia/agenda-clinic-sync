-- Corrige isolamento multi-tenant no scheduling-api (n8n)
--
-- Problema: scheduling-api usa SUPABASE_ANON_KEY sem JWT.
-- Com ANON_KEY, auth.uid() = NULL → get_user_cliente_id() = NULL →
-- RLS bloqueia TODAS as queries diretas silenciosamente.
-- Apenas RPCs SECURITY DEFINER funcionam.
--
-- Solução:
-- 1. Helper get_appointment_tenant() para o scheduling-api resolver cliente_id
--    a partir do appointment_id (sem precisar de JWT)
-- 2. Grant EXECUTE das RPCs rpc_remarcar/cancelar/confirmar para anon
--    (são SECURITY DEFINER, já têm tenant isolation via p_cliente_id)

-- Helper: retorna cliente_id de um agendamento não-excluído
CREATE OR REPLACE FUNCTION public.get_appointment_tenant(p_agendamento_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id UUID;
BEGIN
  SELECT cliente_id INTO v_cliente_id
  FROM agendamentos
  WHERE id = p_agendamento_id
    AND excluido_em IS NULL
  LIMIT 1;
  RETURN v_cliente_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_appointment_tenant(UUID) TO anon, authenticated;

-- Concede execução das RPCs de operação ao anon
-- (são SECURITY DEFINER — o isolamento de tenant é feito pelo p_cliente_id dentro de cada RPC)
GRANT EXECUTE ON FUNCTION public.rpc_remarcar_agendamento TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cancelar_agendamento TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_confirmar_agendamento TO anon, authenticated;
