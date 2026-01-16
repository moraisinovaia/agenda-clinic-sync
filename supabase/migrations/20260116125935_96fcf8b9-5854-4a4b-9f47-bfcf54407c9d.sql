-- Parte A: Corrigir imediatamente os dois pacientes
-- Wellington
UPDATE public.agendamentos
SET 
  status = 'agendado',
  cancelado_por = null,
  cancelado_por_user_id = null,
  cancelado_em = null,
  updated_at = now()
WHERE id = '20c3b46d-8132-48c2-9aaa-bb764d84cf52';

-- Marcilio
UPDATE public.agendamentos
SET 
  status = 'agendado',
  cancelado_por = null,
  cancelado_por_user_id = null,
  cancelado_em = null,
  updated_at = now()
WHERE id = '61701d7c-551e-4177-97f5-806fb46b3d8d';

-- Parte B: Corrigir a função criar_agendamento_atomico para restaurar status ao editar
CREATE OR REPLACE FUNCTION public.criar_agendamento_atomico(
  p_nome_completo text,
  p_data_nascimento text,
  p_convenio text,
  p_telefone text,
  p_celular text,
  p_medico_id uuid,
  p_atendimento_id uuid,
  p_data_agendamento text,
  p_hora_agendamento text,
  p_observacoes text DEFAULT NULL,
  p_criado_por text DEFAULT 'Sistema',
  p_criado_por_user_id uuid DEFAULT NULL,
  p_force_conflict boolean DEFAULT false,
  p_agendamento_id_edicao uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id uuid;
  v_agendamento_id uuid;
  v_cliente_id uuid;
  v_conflito_existente record;
  v_current_status text;
BEGIN
  -- Buscar cliente_id do usuário
  SELECT cliente_id INTO v_cliente_id
  FROM profiles
  WHERE user_id = p_criado_por_user_id;
  
  IF v_cliente_id IS NULL THEN
    SELECT id INTO v_cliente_id FROM clientes LIMIT 1;
  END IF;
  
  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cliente não encontrado'
    );
  END IF;

  -- Se for edição, buscar o status atual
  IF p_agendamento_id_edicao IS NOT NULL THEN
    SELECT status INTO v_current_status
    FROM agendamentos
    WHERE id = p_agendamento_id_edicao;
  END IF;

  -- Verificar conflito de horário (exceto o próprio agendamento em edição)
  SELECT id, pacientes.nome_completo as paciente_nome
  INTO v_conflito_existente
  FROM agendamentos
  JOIN pacientes ON pacientes.id = agendamentos.paciente_id
  WHERE agendamentos.medico_id = p_medico_id
    AND agendamentos.data_agendamento = p_data_agendamento
    AND agendamentos.hora_agendamento = p_hora_agendamento
    AND agendamentos.status NOT IN ('cancelado', 'excluido', 'cancelado_bloqueio')
    AND (p_agendamento_id_edicao IS NULL OR agendamentos.id != p_agendamento_id_edicao)
  LIMIT 1;

  IF v_conflito_existente IS NOT NULL AND NOT p_force_conflict THEN
    RETURN jsonb_build_object(
      'success', false,
      'conflict_detected', true,
      'existing_appointment_id', v_conflito_existente.id,
      'existing_patient_name', v_conflito_existente.paciente_nome,
      'error', format('Já existe agendamento para %s neste horário', v_conflito_existente.paciente_nome)
    );
  END IF;

  -- Buscar ou criar paciente
  SELECT id INTO v_paciente_id
  FROM pacientes
  WHERE UPPER(TRIM(nome_completo)) = UPPER(TRIM(p_nome_completo))
    AND cliente_id = v_cliente_id
  LIMIT 1;

  IF v_paciente_id IS NULL THEN
    INSERT INTO pacientes (
      nome_completo,
      data_nascimento,
      convenio,
      telefone,
      celular,
      cliente_id
    ) VALUES (
      UPPER(TRIM(p_nome_completo)),
      p_data_nascimento,
      UPPER(TRIM(p_convenio)),
      p_telefone,
      p_celular,
      v_cliente_id
    )
    RETURNING id INTO v_paciente_id;
  ELSE
    -- Atualizar dados do paciente existente
    UPDATE pacientes
    SET 
      data_nascimento = COALESCE(p_data_nascimento, data_nascimento),
      convenio = UPPER(TRIM(p_convenio)),
      telefone = COALESCE(p_telefone, telefone),
      celular = COALESCE(p_celular, celular),
      updated_at = now()
    WHERE id = v_paciente_id;
  END IF;

  -- Criar ou atualizar agendamento
  IF p_agendamento_id_edicao IS NOT NULL THEN
    -- Modo edição: atualizar agendamento existente
    UPDATE agendamentos
    SET 
      paciente_id = v_paciente_id,
      medico_id = p_medico_id,
      atendimento_id = p_atendimento_id,
      data_agendamento = p_data_agendamento,
      hora_agendamento = p_hora_agendamento,
      convenio = UPPER(TRIM(p_convenio)),
      observacoes = UPPER(TRIM(p_observacoes)),
      updated_at = now(),
      alterado_por_user_id = p_criado_por_user_id,
      -- CORREÇÃO: Restaurar status se estava cancelado por bloqueio
      status = CASE 
        WHEN v_current_status = 'cancelado_bloqueio' THEN 'agendado'
        ELSE status
      END,
      -- Limpar campos de cancelamento se restaurando
      cancelado_por = CASE 
        WHEN v_current_status = 'cancelado_bloqueio' THEN NULL
        ELSE cancelado_por
      END,
      cancelado_por_user_id = CASE 
        WHEN v_current_status = 'cancelado_bloqueio' THEN NULL
        ELSE cancelado_por_user_id
      END,
      cancelado_em = CASE 
        WHEN v_current_status = 'cancelado_bloqueio' THEN NULL
        ELSE cancelado_em
      END
    WHERE id = p_agendamento_id_edicao
    RETURNING id INTO v_agendamento_id;
  ELSE
    -- Modo criação: criar novo agendamento
    INSERT INTO agendamentos (
      paciente_id,
      medico_id,
      atendimento_id,
      data_agendamento,
      hora_agendamento,
      convenio,
      observacoes,
      status,
      criado_por,
      criado_por_user_id,
      cliente_id
    ) VALUES (
      v_paciente_id,
      p_medico_id,
      p_atendimento_id,
      p_data_agendamento,
      p_hora_agendamento,
      UPPER(TRIM(p_convenio)),
      UPPER(TRIM(p_observacoes)),
      'agendado',
      p_criado_por,
      p_criado_por_user_id,
      v_cliente_id
    )
    RETURNING id INTO v_agendamento_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'agendamento_id', v_agendamento_id,
    'paciente_id', v_paciente_id,
    'is_edit', p_agendamento_id_edicao IS NOT NULL,
    'status_restored', v_current_status = 'cancelado_bloqueio'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;