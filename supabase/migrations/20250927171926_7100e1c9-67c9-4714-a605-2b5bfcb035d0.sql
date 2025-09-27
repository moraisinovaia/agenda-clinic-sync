-- Adicionar campos para exclusão de agendamentos
ALTER TABLE public.agendamentos 
ADD COLUMN excluido_por text,
ADD COLUMN excluido_por_user_id uuid,
ADD COLUMN excluido_em timestamp with time zone;

-- Criar função para exclusão soft de agendamentos
CREATE OR REPLACE FUNCTION public.excluir_agendamento_soft(
  p_agendamento_id uuid,
  p_excluido_por text,
  p_excluido_por_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Atualizar o agendamento para status excluído
  UPDATE public.agendamentos 
  SET 
    status = 'excluido',
    excluido_por = p_excluido_por,
    excluido_por_user_id = p_excluido_por_user_id,
    excluido_em = NOW(),
    updated_at = NOW()
  WHERE id = p_agendamento_id 
    AND status = 'cancelado'; -- Só permite excluir agendamentos cancelados

  -- Verificar se a atualização foi bem-sucedida
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Agendamento não encontrado ou não está cancelado'
    );
  END IF;

  -- Retornar sucesso
  RETURN json_build_object(
    'success', true,
    'message', 'Agendamento excluído com sucesso'
  );
END;
$$;