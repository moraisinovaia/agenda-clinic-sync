-- Remover a função atual
DROP FUNCTION IF EXISTS public.criar_agendamento_atomico(
  text, text, text, text, text, uuid, uuid, text, text, text, text, uuid, boolean, uuid
);

-- Recriar a função com correção da coluna "id" ambígua
CREATE OR REPLACE FUNCTION public.criar_agendamento_atomico(
  p_nome_completo text,
  p_data_nascimento text,
  p_telefone text,
  p_celular text,
  p_convenio text,
  p_medico_id uuid,
  p_atendimento_id uuid,
  p_data_agendamento text,
  p_hora_agendamento text,
  p_observacoes text DEFAULT NULL,
  p_criado_por text DEFAULT NULL,
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
  v_conflito_existente RECORD;
  v_data_agendamento date;
  v_hora_agendamento time;
  v_status_anterior text;
  v_paciente_conflito_id uuid;
BEGIN
  -- Converter strings para tipos apropriados
  v_data_agendamento := p_data_agendamento::date;
  v_hora_agendamento := p_hora_agendamento::time;

  -- Se estamos editando, verificar se existe e pegar status anterior
  IF p_agendamento_id_edicao IS NOT NULL THEN
    SELECT status INTO v_status_anterior
    FROM agendamentos
    WHERE id = p_agendamento_id_edicao;
    
    IF v_status_anterior IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Agendamento não encontrado para edição',
        'error_type', 'not_found'
      );
    END IF;
  END IF;

  -- Verificar conflito de horário (excluindo o próprio agendamento em caso de edição)
  -- CORREÇÃO: Qualificar agendamentos.id para evitar ambiguidade com pacientes.id
  SELECT agendamentos.id, pacientes.nome_completo as paciente_nome, agendamentos.paciente_id
  INTO v_conflito_existente
  FROM agendamentos
  JOIN pacientes ON pacientes.id = agendamentos.paciente_id
  WHERE agendamentos.medico_id = p_medico_id
    AND agendamentos.data_agendamento = v_data_agendamento
    AND agendamentos.hora_agendamento = v_hora_agendamento
    AND agendamentos.status NOT IN ('cancelado', 'cancelado_paciente', 'cancelado_clinica', 'cancelado_bloqueio')
    AND (p_agendamento_id_edicao IS NULL OR agendamentos.id != p_agendamento_id_edicao);

  IF v_conflito_existente.id IS NOT NULL THEN
    IF NOT p_force_conflict THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Já existe um agendamento neste horário para ' || v_conflito_existente.paciente_nome,
        'error_type', 'conflict',
        'conflicting_appointment_id', v_conflito_existente.id,
        'conflicting_patient_name', v_conflito_existente.paciente_nome
      );
    END IF;
  END IF;

  -- Buscar ou criar paciente
  SELECT id INTO v_paciente_id
  FROM pacientes
  WHERE LOWER(TRIM(nome_completo)) = LOWER(TRIM(p_nome_completo))
    AND celular = p_celular
  LIMIT 1;

  IF v_paciente_id IS NULL THEN
    INSERT INTO pacientes (nome_completo, data_nascimento, telefone, celular, convenio)
    VALUES (
      TRIM(p_nome_completo),
      CASE WHEN p_data_nascimento IS NOT NULL AND p_data_nascimento != '' 
           THEN p_data_nascimento::date 
           ELSE NULL 
      END,
      NULLIF(TRIM(p_telefone), ''),
      p_celular,
      NULLIF(TRIM(p_convenio), '')
    )
    RETURNING id INTO v_paciente_id;
  ELSE
    -- Atualizar dados do paciente existente
    UPDATE pacientes
    SET 
      data_nascimento = CASE 
        WHEN p_data_nascimento IS NOT NULL AND p_data_nascimento != '' 
        THEN p_data_nascimento::date 
        ELSE data_nascimento 
      END,
      telefone = COALESCE(NULLIF(TRIM(p_telefone), ''), telefone),
      convenio = COALESCE(NULLIF(TRIM(p_convenio), ''), convenio),
      updated_at = NOW()
    WHERE id = v_paciente_id;
  END IF;

  -- Verificar se o paciente tinha agendamento cancelado por bloqueio para o mesmo médico/data/hora
  -- e restaurar para 'agendado' se for o caso
  IF p_agendamento_id_edicao IS NULL THEN
    SELECT id INTO v_agendamento_id
    FROM agendamentos
    WHERE paciente_id = v_paciente_id
      AND medico_id = p_medico_id
      AND data_agendamento = v_data_agendamento
      AND hora_agendamento = v_hora_agendamento
      AND status = 'cancelado_bloqueio';
    
    IF v_agendamento_id IS NOT NULL THEN
      -- Restaurar o agendamento cancelado por bloqueio
      UPDATE agendamentos
      SET 
        status = 'agendado',
        atendimento_id = p_atendimento_id,
        observacoes = COALESCE(p_observacoes, observacoes),
        updated_at = NOW(),
        criado_por = COALESCE(p_criado_por, criado_por),
        criado_por_user_id = COALESCE(p_criado_por_user_id, criado_por_user_id)
      WHERE id = v_agendamento_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'agendamento_id', v_agendamento_id,
        'paciente_id', v_paciente_id,
        'message', 'Agendamento restaurado com sucesso (estava cancelado por bloqueio)',
        'was_restored', true
      );
    END IF;
  END IF;

  -- Criar ou atualizar agendamento
  IF p_agendamento_id_edicao IS NOT NULL THEN
    -- Atualizar agendamento existente
    UPDATE agendamentos
    SET 
      paciente_id = v_paciente_id,
      medico_id = p_medico_id,
      atendimento_id = p_atendimento_id,
      data_agendamento = v_data_agendamento,
      hora_agendamento = v_hora_agendamento,
      observacoes = p_observacoes,
      updated_at = NOW(),
      status = CASE 
        WHEN v_status_anterior = 'cancelado_bloqueio' THEN 'agendado'
        ELSE COALESCE(status, 'agendado')
      END
    WHERE id = p_agendamento_id_edicao
    RETURNING id INTO v_agendamento_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'agendamento_id', v_agendamento_id,
      'paciente_id', v_paciente_id,
      'message', 'Agendamento atualizado com sucesso',
      'status_restored', v_status_anterior = 'cancelado_bloqueio'
    );
  ELSE
    -- Criar novo agendamento
    INSERT INTO agendamentos (
      paciente_id,
      medico_id,
      atendimento_id,
      data_agendamento,
      hora_agendamento,
      status,
      observacoes,
      criado_por,
      criado_por_user_id
    )
    VALUES (
      v_paciente_id,
      p_medico_id,
      p_atendimento_id,
      v_data_agendamento,
      v_hora_agendamento,
      'agendado',
      p_observacoes,
      p_criado_por,
      p_criado_por_user_id
    )
    RETURNING id INTO v_agendamento_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'agendamento_id', v_agendamento_id,
      'paciente_id', v_paciente_id,
      'message', 'Agendamento criado com sucesso'
    );
  END IF;

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Conflito de dados únicos detectado',
      'error_type', 'unique_violation'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_type', 'database_error'
    );
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.criar_agendamento_atomico(
  text, text, text, text, text, uuid, uuid, text, text, text, text, uuid, boolean, uuid
) TO anon, authenticated;