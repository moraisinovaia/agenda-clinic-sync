-- Criar função para desconfirmar agendamento
CREATE OR REPLACE FUNCTION public.desconfirmar_agendamento(p_agendamento_id uuid, p_desconfirmado_por text, p_desconfirmado_por_user_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Atualizar o agendamento para desconfirmado (volta para agendado)
  UPDATE public.agendamentos 
  SET 
    status = 'agendado',
    confirmado_por = NULL,
    confirmado_por_user_id = NULL,
    confirmado_em = NULL,
    updated_at = NOW()
  WHERE id = p_agendamento_id 
    AND status = 'confirmado';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Agendamento não encontrado ou não está confirmado'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Agendamento desconfirmado com sucesso'
  );
END;
$function$;