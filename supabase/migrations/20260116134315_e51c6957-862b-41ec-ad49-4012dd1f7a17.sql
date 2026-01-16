-- =====================================================
-- UNIFICAÇÃO: criar_agendamento_atomico
-- Remove as duas versões e cria uma única versão completa
-- =====================================================

-- Etapa 1: DROP das duas versões existentes
DROP FUNCTION IF EXISTS public.criar_agendamento_atomico(text, text, text, text, text, uuid, uuid, date, time, text, text, uuid);
DROP FUNCTION IF EXISTS public.criar_agendamento_atomico(text, text, text, text, text, uuid, uuid, text, text, text, text, uuid, boolean, uuid);

-- Etapa 2: Criar versão unificada com todas as features
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
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id uuid;
  v_agendamento_id uuid;
  v_cliente_id uuid;
  v_medico_nome text;
  v_conflito_existente record;
  v_data_convertida date;
  v_hora_convertida time;
  v_warnings text[] := ARRAY[]::text[];
  v_is_editing boolean := false;
  v_criado_por_usado text;
  v_status_anterior text;
BEGIN
  -- Validações básicas
  IF p_nome_completo IS NULL OR trim(p_nome_completo) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Nome do paciente é obrigatório'
    );
  END IF;

  IF p_celular IS NULL OR trim(p_celular) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Celular é obrigatório'
    );
  END IF;

  -- Converter data e hora de text para tipos nativos
  BEGIN
    v_data_convertida := p_data_agendamento::date;
    v_hora_convertida := p_hora_agendamento::time;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Formato de data ou hora inválido. Use YYYY-MM-DD para data e HH:MM para hora.'
    );
  END;

  -- Buscar cliente_id do médico (CRÍTICO para multiclientes)
  SELECT m.cliente_id, m.nome INTO v_cliente_id, v_medico_nome
  FROM medicos m
  WHERE m.id = p_medico_id;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Médico não encontrado ou sem clínica associada'
    );
  END IF;

  -- Determinar se é edição ou novo agendamento
  IF p_agendamento_id_edicao IS NOT NULL THEN
    v_is_editing := true;
    v_agendamento_id := p_agendamento_id_edicao;
    
    -- Buscar status anterior para possível restauração
    SELECT status INTO v_status_anterior
    FROM agendamentos
    WHERE id = p_agendamento_id_edicao;
  END IF;

  -- Verificar conflitos de horário (exceto para edição do mesmo agendamento)
  SELECT id, paciente_id INTO v_conflito_existente
  FROM agendamentos
  WHERE medico_id = p_medico_id
    AND data_agendamento = v_data_convertida
    AND hora_agendamento = v_hora_convertida
    AND status NOT IN ('cancelado', 'excluido', 'cancelado_bloqueio')
    AND (p_agendamento_id_edicao IS NULL OR id != p_agendamento_id_edicao);

  IF v_conflito_existente.id IS NOT NULL AND NOT p_force_conflict THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Já existe um agendamento para este médico neste horário',
      'conflict_detected', true,
      'conflict_details', jsonb_build_object(
        'agendamento_id', v_conflito_existente.id,
        'paciente_id', v_conflito_existente.paciente_id
      )
    );
  END IF;

  -- Buscar ou criar paciente (FILTRANDO POR CLIENTE_ID)
  SELECT id INTO v_paciente_id
  FROM pacientes
  WHERE upper(trim(nome_completo)) = upper(trim(p_nome_completo))
    AND data_nascimento = p_data_nascimento::date
    AND cliente_id = v_cliente_id
  LIMIT 1;

  IF v_paciente_id IS NULL THEN
    -- Criar novo paciente COM cliente_id
    INSERT INTO pacientes (
      nome_completo,
      data_nascimento,
      telefone,
      celular,
      convenio,
      cliente_id
    ) VALUES (
      trim(p_nome_completo),
      p_data_nascimento::date,
      nullif(trim(p_telefone), ''),
      trim(p_celular),
      coalesce(trim(p_convenio), 'Particular'),
      v_cliente_id
    )
    RETURNING id INTO v_paciente_id;

    v_warnings := array_append(v_warnings, 'Novo paciente cadastrado automaticamente');
  ELSE
    -- Atualizar dados do paciente existente
    UPDATE pacientes SET
      telefone = coalesce(nullif(trim(p_telefone), ''), telefone),
      celular = coalesce(nullif(trim(p_celular), ''), celular),
      convenio = coalesce(nullif(trim(p_convenio), ''), convenio),
      updated_at = now()
    WHERE id = v_paciente_id;
  END IF;

  -- Determinar criado_por
  v_criado_por_usado := coalesce(p_criado_por, 'Sistema');

  IF v_is_editing THEN
    -- Atualizar agendamento existente
    UPDATE agendamentos SET
      paciente_id = v_paciente_id,
      medico_id = p_medico_id,
      atendimento_id = p_atendimento_id,
      data_agendamento = v_data_convertida,
      hora_agendamento = v_hora_convertida,
      observacoes = p_observacoes,
      updated_at = now(),
      alterado_por_user_id = p_criado_por_user_id,
      -- Restaurar status se era cancelado_bloqueio
      status = CASE 
        WHEN v_status_anterior = 'cancelado_bloqueio' THEN 'agendado'
        ELSE status
      END
    WHERE id = v_agendamento_id;

    IF v_status_anterior = 'cancelado_bloqueio' THEN
      v_warnings := array_append(v_warnings, 'Agendamento restaurado (estava cancelado por bloqueio)');
    END IF;
  ELSE
    -- Criar novo agendamento
    INSERT INTO agendamentos (
      paciente_id,
      medico_id,
      atendimento_id,
      data_agendamento,
      hora_agendamento,
      observacoes,
      status,
      criado_por,
      criado_por_user_id,
      cliente_id
    ) VALUES (
      v_paciente_id,
      p_medico_id,
      p_atendimento_id,
      v_data_convertida,
      v_hora_convertida,
      p_observacoes,
      'agendado',
      v_criado_por_usado,
      p_criado_por_user_id,
      v_cliente_id
    )
    RETURNING id INTO v_agendamento_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'agendamento_id', v_agendamento_id,
    'paciente_id', v_paciente_id,
    'is_editing', v_is_editing,
    'criado_por_usado', v_criado_por_usado,
    'warnings', v_warnings,
    'message', CASE 
      WHEN v_is_editing THEN 'Agendamento atualizado com sucesso'
      ELSE 'Agendamento criado com sucesso'
    END
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;

-- Etapa 3: Conceder permissões
GRANT EXECUTE ON FUNCTION public.criar_agendamento_atomico(text, text, text, text, text, uuid, uuid, text, text, text, text, uuid, boolean, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.criar_agendamento_atomico(text, text, text, text, text, uuid, uuid, text, text, text, text, uuid, boolean, uuid) TO authenticated;

-- Comentário documentando a função
COMMENT ON FUNCTION public.criar_agendamento_atomico IS 'Função unificada para criar/editar agendamentos. Busca cliente_id automaticamente do médico para garantir isolamento multicliente. Suporta edição via p_agendamento_id_edicao e conflitos forçados via p_force_conflict.';