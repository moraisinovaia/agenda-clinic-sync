-- ─────────────────────────────────────────────────────────────────
-- Cancelamento com motivo + Reativação de agendamentos
-- 1. Novas colunas em agendamentos
-- 2. Atualiza overload 2 de cancelar_agendamento_soft (aceita p_motivo)
-- 3. Corrige overload 1 (motivo_cancelamento agora existe)
-- 4. Cria RPC reativar_agendamento
-- ─────────────────────────────────────────────────────────────────

-- ── 1. Colunas novas ──────────────────────────────────────────────
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS motivo_cancelamento    text,
  ADD COLUMN IF NOT EXISTS reativado_por          text,
  ADD COLUMN IF NOT EXISTS reativado_por_user_id  uuid,
  ADD COLUMN IF NOT EXISTS reativado_em           timestamptz;

-- ── 2. Overload 2: aceita p_motivo ───────────────────────────────
-- Assinatura usada pelo frontend: p_cancelado_por + p_cancelado_por_user_id
-- Adicionamos p_motivo sem quebrar chamadas existentes (DEFAULT NULL)
CREATE OR REPLACE FUNCTION public.cancelar_agendamento_soft(
  p_agendamento_id        uuid,
  p_cancelado_por         text    DEFAULT NULL,
  p_cancelado_por_user_id uuid    DEFAULT NULL,
  p_motivo                text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_cliente_id    uuid;
  v_agendamento_cliente_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    SELECT cliente_id INTO v_caller_cliente_id
      FROM public.profiles WHERE user_id = auth.uid();

    SELECT cliente_id INTO v_agendamento_cliente_id
      FROM public.agendamentos WHERE id = p_agendamento_id;

    IF v_agendamento_cliente_id IS NULL THEN
      RAISE EXCEPTION 'Agendamento não encontrado: %', p_agendamento_id;
    END IF;

    IF v_caller_cliente_id IS DISTINCT FROM v_agendamento_cliente_id THEN
      RAISE EXCEPTION 'Acesso negado: agendamento pertence a outra clínica';
    END IF;
  END IF;

  UPDATE public.agendamentos
     SET status                 = 'cancelado',
         cancelado_em           = now(),
         cancelado_por          = COALESCE(p_cancelado_por, 'sistema'),
         cancelado_por_user_id  = p_cancelado_por_user_id,
         motivo_cancelamento    = p_motivo,
         updated_at             = now()
   WHERE id = p_agendamento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado: %', p_agendamento_id;
  END IF;
END;
$$;

-- ── 3. Overload 1: agora funciona corretamente (coluna existe) ────
-- Assinatura: só p_motivo (usado pela API de integração)
CREATE OR REPLACE FUNCTION public.cancelar_agendamento_soft(
  p_agendamento_id uuid,
  p_motivo         text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id          uuid;
  v_caller_cliente_id  uuid;
  v_agend_cliente_id   uuid;
  v_is_admin           boolean;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = v_caller_id AND role IN ('admin', 'super_admin')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    SELECT cliente_id INTO v_caller_cliente_id
      FROM public.profiles WHERE user_id = v_caller_id;
    SELECT cliente_id INTO v_agend_cliente_id
      FROM public.agendamentos WHERE id = p_agendamento_id;
    IF v_agend_cliente_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;
    IF v_caller_cliente_id IS NULL OR v_caller_cliente_id <> v_agend_cliente_id THEN
      RETURN json_build_object('success', false, 'error', 'Acesso negado');
    END IF;
  END IF;

  UPDATE public.agendamentos
     SET status               = 'cancelado',
         motivo_cancelamento  = COALESCE(p_motivo, 'Cancelado pelo usuário'),
         cancelado_por        = (SELECT nome FROM public.profiles WHERE user_id = v_caller_id LIMIT 1),
         cancelado_por_user_id = v_caller_id,
         cancelado_em         = now(),
         updated_at           = now()
   WHERE id = p_agendamento_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Agendamento cancelado');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ── 4. RPC reativar_agendamento ───────────────────────────────────
-- Preserva histórico do cancelamento (cancelado_por, cancelado_por_user_id,
-- motivo_cancelamento). Apenas limpa cancelado_em e seta reativado_*.
CREATE OR REPLACE FUNCTION public.reativar_agendamento(
  p_agendamento_id        uuid,
  p_reativado_por         text    DEFAULT NULL,
  p_reativado_por_user_id uuid    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agend       RECORD;
  v_conflito    integer;
  v_cliente_id  uuid;
BEGIN
  -- Advisory lock: evita conflito em concorrência
  PERFORM pg_advisory_xact_lock(
    hashtext(p_agendamento_id::text || 'reativar')
  );

  SELECT * INTO v_agend
    FROM public.agendamentos
   WHERE id = p_agendamento_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  IF v_agend.status <> 'cancelado' THEN
    RETURN json_build_object('success', false,
      'error', 'Agendamento não está cancelado (status: ' || v_agend.status || ')');
  END IF;

  -- Validar tenant
  IF NOT public.is_super_admin() THEN
    v_cliente_id := get_user_cliente_id();
    IF v_cliente_id IS DISTINCT FROM v_agend.cliente_id THEN
      RETURN json_build_object('success', false, 'error', 'Acesso negado');
    END IF;
  END IF;

  -- Verificar conflito de slot (outro agendamento ativo no mesmo horário)
  SELECT COUNT(*) INTO v_conflito
    FROM public.agendamentos
   WHERE medico_id        = v_agend.medico_id
     AND data_agendamento = v_agend.data_agendamento
     AND hora_agendamento = v_agend.hora_agendamento
     AND status           IN ('agendado', 'confirmado')
     AND excluido_em      IS NULL
     AND cancelado_em     IS NULL
     AND id               <> p_agendamento_id;

  IF v_conflito > 0 THEN
    RETURN json_build_object(
      'success',  false,
      'error',    'SLOT_OCUPADO',
      'message',  'Este horário já foi ocupado por outro paciente. '
               || 'Não é possível reativar este agendamento.'
    );
  END IF;

  -- Reativar preservando histórico do cancelamento
  UPDATE public.agendamentos
     SET status                  = 'agendado',
         cancelado_em            = NULL,
         reativado_por           = COALESCE(p_reativado_por, 'sistema'),
         reativado_por_user_id   = p_reativado_por_user_id,
         reativado_em            = now(),
         updated_at              = now()
   WHERE id = p_agendamento_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Agendamento reativado com sucesso'
  );
END;
$$;
