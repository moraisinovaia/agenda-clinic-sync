-- Corrigir as últimas 4 funções sem search_path
CREATE OR REPLACE FUNCTION public.cancelar_agendamento_soft(
  p_agendamento_id uuid, 
  p_cancelado_por text, 
  p_cancelado_por_user_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agendamentos 
  SET 
    status = 'cancelado',
    cancelado_por = p_cancelado_por,
    cancelado_por_user_id = p_cancelado_por_user_id,
    cancelado_em = NOW(),
    updated_at = NOW()
  WHERE id = p_agendamento_id 
    AND status IN ('agendado', 'confirmado');

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Agendamento não encontrado ou já foi cancelado'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Agendamento cancelado com sucesso'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirmar_agendamento(
  p_agendamento_id uuid, 
  p_confirmado_por text, 
  p_confirmado_por_user_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agendamentos 
  SET 
    status = 'confirmado',
    confirmado_por = p_confirmado_por,
    confirmado_por_user_id = p_confirmado_por_user_id,
    confirmado_em = NOW(),
    updated_at = NOW()
  WHERE id = p_agendamento_id 
    AND status = 'agendado';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Agendamento não encontrado ou não pode ser confirmado'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Agendamento confirmado com sucesso'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.desconfirmar_agendamento(
  p_agendamento_id uuid, 
  p_desconfirmado_por text, 
  p_desconfirmado_por_user_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
$$;

CREATE OR REPLACE FUNCTION public.atualizar_dados_paciente(
  p_paciente_id uuid, 
  p_nome_completo text, 
  p_data_nascimento date, 
  p_convenio text, 
  p_telefone text DEFAULT NULL::text, 
  p_celular text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pacientes 
  SET 
    nome_completo = p_nome_completo,
    data_nascimento = p_data_nascimento,
    convenio = p_convenio,
    telefone = COALESCE(p_telefone, telefone),
    celular = COALESCE(p_celular, celular),
    updated_at = NOW()
  WHERE id = p_paciente_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Paciente não encontrado'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Dados do paciente atualizados com sucesso',
    'paciente_id', p_paciente_id
  );
END;
$$;