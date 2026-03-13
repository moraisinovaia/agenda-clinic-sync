-- Recriar as 4 RPCs com parâmetros de auditoria + GRANT EXECUTE

-- 1. confirmar_agendamento
CREATE OR REPLACE FUNCTION public.confirmar_agendamento(
  p_agendamento_id uuid,
  p_confirmado_por text DEFAULT NULL,
  p_confirmado_por_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE agendamentos
  SET status = 'confirmado',
      confirmado_em = now(),
      confirmado_por = COALESCE(p_confirmado_por, 'sistema'),
      confirmado_por_user_id = p_confirmado_por_user_id,
      updated_at = now()
  WHERE id = p_agendamento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado: %', p_agendamento_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirmar_agendamento(uuid, text, uuid) TO authenticated;

-- 2. desconfirmar_agendamento
CREATE OR REPLACE FUNCTION public.desconfirmar_agendamento(
  p_agendamento_id uuid,
  p_desconfirmado_por text DEFAULT NULL,
  p_desconfirmado_por_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE agendamentos
  SET status = 'agendado',
      confirmado_em = NULL,
      confirmado_por = NULL,
      confirmado_por_user_id = NULL,
      alterado_por_user_id = p_desconfirmado_por_user_id,
      updated_at = now()
  WHERE id = p_agendamento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado: %', p_agendamento_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.desconfirmar_agendamento(uuid, text, uuid) TO authenticated;

-- 3. cancelar_agendamento_soft
CREATE OR REPLACE FUNCTION public.cancelar_agendamento_soft(
  p_agendamento_id uuid,
  p_cancelado_por text DEFAULT NULL,
  p_cancelado_por_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE agendamentos
  SET status = 'cancelado',
      cancelado_em = now(),
      cancelado_por = COALESCE(p_cancelado_por, 'sistema'),
      cancelado_por_user_id = p_cancelado_por_user_id,
      updated_at = now()
  WHERE id = p_agendamento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado: %', p_agendamento_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancelar_agendamento_soft(uuid, text, uuid) TO authenticated;

-- 4. excluir_agendamento_soft
CREATE OR REPLACE FUNCTION public.excluir_agendamento_soft(
  p_agendamento_id uuid,
  p_excluido_por text DEFAULT NULL,
  p_excluido_por_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE agendamentos
  SET excluido_em = now(),
      excluido_por = COALESCE(p_excluido_por, 'sistema'),
      excluido_por_user_id = p_excluido_por_user_id,
      updated_at = now()
  WHERE id = p_agendamento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado: %', p_agendamento_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.excluir_agendamento_soft(uuid, text, uuid) TO authenticated;