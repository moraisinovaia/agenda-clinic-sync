-- Função para agendamento por ordem de chegada (verifica contagem, não horário exato)
CREATE OR REPLACE FUNCTION public.criar_agendamento_ordem_chegada(
  p_cliente_id UUID,
  p_nome_completo TEXT,
  p_data_nascimento DATE,
  p_convenio TEXT,
  p_telefone TEXT DEFAULT NULL,
  p_celular TEXT DEFAULT NULL,
  p_medico_id UUID DEFAULT NULL,
  p_atendimento_id UUID DEFAULT NULL,
  p_data_agendamento DATE DEFAULT NULL,
  p_hora_inicio_periodo TIME DEFAULT NULL,
  p_hora_fim_periodo TIME DEFAULT NULL,
  p_limite_vagas INTEGER DEFAULT 10,
  p_observacoes TEXT DEFAULT NULL,
  p_criado_por TEXT DEFAULT 'api_externa'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id UUID;
  v_agendamento_id UUID;
  v_vagas_ocupadas INTEGER;
  v_hora_agendamento TIME;
  v_paciente_existente RECORD;
  v_idade INTEGER;
  v_medico RECORD;
  v_atendimento RECORD;
BEGIN
  -- ========================================
  -- VALIDAÇÕES BÁSICAS
  -- ========================================
  
  IF p_nome_completo IS NULL OR LENGTH(TRIM(p_nome_completo)) < 3 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'NOME_INVALIDO',
      'message', 'Nome do paciente deve ter pelo menos 3 caracteres'
    );
  END IF;
  
  IF p_medico_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'MEDICO_OBRIGATORIO',
      'message', 'ID do médico é obrigatório'
    );
  END IF;
  
  IF p_data_agendamento IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'DATA_OBRIGATORIA',
      'message', 'Data do agendamento é obrigatória'
    );
  END IF;
  
  IF p_hora_inicio_periodo IS NULL OR p_hora_fim_periodo IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'PERIODO_OBRIGATORIO',
      'message', 'Horário de início e fim do período são obrigatórios'
    );
  END IF;
  
  -- ========================================
  -- BUSCAR MÉDICO E VALIDAR
  -- ========================================
  
  SELECT * INTO v_medico
  FROM public.medicos
  WHERE id = p_medico_id AND cliente_id = p_cliente_id AND ativo = true;
  
  IF v_medico IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'MEDICO_NAO_ENCONTRADO',
      'message', 'Médico não encontrado ou inativo'
    );
  END IF;
  
  -- ========================================
  -- VALIDAR IDADE DO PACIENTE
  -- ========================================
  
  IF p_data_nascimento IS NOT NULL THEN
    v_idade := EXTRACT(YEAR FROM age(CURRENT_DATE, p_data_nascimento));
    
    -- Validar idade mínima
    IF v_medico.idade_minima IS NOT NULL AND v_idade < v_medico.idade_minima THEN
      RETURN json_build_object(
        'success', false,
        'error', 'IDADE_MINIMA',
        'message', format('Este médico atende apenas pacientes a partir de %s anos. Idade do paciente: %s anos.', v_medico.idade_minima, v_idade)
      );
    END IF;
    
    -- Validar idade máxima
    IF v_medico.idade_maxima IS NOT NULL AND v_idade > v_medico.idade_maxima THEN
      RETURN json_build_object(
        'success', false,
        'error', 'IDADE_MAXIMA',
        'message', format('Este médico atende apenas pacientes até %s anos. Idade do paciente: %s anos.', v_medico.idade_maxima, v_idade)
      );
    END IF;
    
    -- Validar atende crianças (< 18 anos)
    IF v_idade < 18 AND v_medico.atende_criancas = false THEN
      RETURN json_build_object(
        'success', false,
        'error', 'NAO_ATENDE_CRIANCAS',
        'message', 'Este médico não atende pacientes menores de 18 anos'
      );
    END IF;
    
    -- Validar atende adultos (>= 18 anos)
    IF v_idade >= 18 AND v_medico.atende_adultos = false THEN
      RETURN json_build_object(
        'success', false,
        'error', 'NAO_ATENDE_ADULTOS',
        'message', 'Este médico não atende pacientes adultos (18+ anos)'
      );
    END IF;
  END IF;
  
  -- ========================================
  -- VERIFICAR CONVÊNIO ACEITO
  -- ========================================
  
  IF v_medico.convenios_aceitos IS NOT NULL AND array_length(v_medico.convenios_aceitos, 1) > 0 THEN
    IF NOT (UPPER(TRIM(p_convenio)) = ANY(v_medico.convenios_aceitos)) THEN
      RETURN json_build_object(
        'success', false,
        'error', 'CONVENIO_NAO_ACEITO',
        'message', format('O convênio %s não é aceito por este médico. Convênios aceitos: %s', 
                         p_convenio, 
                         array_to_string(v_medico.convenios_aceitos, ', '))
      );
    END IF;
  END IF;
  
  -- ========================================
  -- CONTAR VAGAS OCUPADAS NO PERÍODO
  -- ========================================
  
  SELECT COUNT(*)
  INTO v_vagas_ocupadas
  FROM public.agendamentos
  WHERE medico_id = p_medico_id
    AND cliente_id = p_cliente_id
    AND data_agendamento = p_data_agendamento
    AND hora_agendamento >= p_hora_inicio_periodo
    AND hora_agendamento < p_hora_fim_periodo
    AND status IN ('agendado', 'confirmado');
  
  -- Verificar se período está lotado
  IF v_vagas_ocupadas >= p_limite_vagas THEN
    RETURN json_build_object(
      'success', false,
      'error', 'PERIODO_LOTADO',
      'message', format('Período lotado: %s/%s vagas ocupadas', v_vagas_ocupadas, p_limite_vagas),
      'vagas_ocupadas', v_vagas_ocupadas,
      'vagas_total', p_limite_vagas
    );
  END IF;
  
  -- ========================================
  -- ESCOLHER HORÁRIO DENTRO DO PERÍODO
  -- ========================================
  
  -- Usar o horário de início + offset baseado nas vagas ocupadas (para organização)
  v_hora_agendamento := p_hora_inicio_periodo + (v_vagas_ocupadas * interval '1 minute');
  
  -- Garantir que está dentro do período
  IF v_hora_agendamento >= p_hora_fim_periodo THEN
    v_hora_agendamento := p_hora_inicio_periodo;
  END IF;
  
  -- ========================================
  -- BUSCAR OU CRIAR PACIENTE
  -- ========================================
  
  -- Primeiro tentar encontrar paciente existente
  SELECT id INTO v_paciente_existente
  FROM public.pacientes
  WHERE cliente_id = p_cliente_id
    AND UPPER(TRIM(nome_completo)) = UPPER(TRIM(p_nome_completo))
    AND (data_nascimento = p_data_nascimento OR (data_nascimento IS NULL AND p_data_nascimento IS NULL))
  LIMIT 1;
  
  IF v_paciente_existente.id IS NOT NULL THEN
    v_paciente_id := v_paciente_existente.id;
    
    -- Atualizar dados do paciente se necessário
    UPDATE public.pacientes
    SET 
      convenio = COALESCE(UPPER(TRIM(p_convenio)), convenio),
      telefone = COALESCE(p_telefone, telefone),
      celular = COALESCE(p_celular, celular),
      updated_at = NOW()
    WHERE id = v_paciente_id;
  ELSE
    -- Criar novo paciente
    INSERT INTO public.pacientes (
      cliente_id,
      nome_completo,
      data_nascimento,
      convenio,
      telefone,
      celular
    ) VALUES (
      p_cliente_id,
      UPPER(TRIM(p_nome_completo)),
      p_data_nascimento,
      UPPER(TRIM(p_convenio)),
      p_telefone,
      p_celular
    )
    RETURNING id INTO v_paciente_id;
  END IF;
  
  -- ========================================
  -- CRIAR AGENDAMENTO
  -- ========================================
  
  INSERT INTO public.agendamentos (
    cliente_id,
    paciente_id,
    medico_id,
    atendimento_id,
    data_agendamento,
    hora_agendamento,
    convenio,
    observacoes,
    status,
    criado_por
  ) VALUES (
    p_cliente_id,
    v_paciente_id,
    p_medico_id,
    p_atendimento_id,
    p_data_agendamento,
    v_hora_agendamento,
    UPPER(TRIM(p_convenio)),
    p_observacoes,
    'agendado',
    p_criado_por
  )
  RETURNING id INTO v_agendamento_id;
  
  -- ========================================
  -- RETORNAR SUCESSO
  -- ========================================
  
  RETURN json_build_object(
    'success', true,
    'agendamento_id', v_agendamento_id,
    'paciente_id', v_paciente_id,
    'hora_agendamento', v_hora_agendamento::text,
    'vagas_ocupadas', v_vagas_ocupadas + 1,
    'vagas_total', p_limite_vagas,
    'message', format('Agendamento criado com sucesso. Vagas: %s/%s', v_vagas_ocupadas + 1, p_limite_vagas)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'ERRO_INTERNO',
      'message', SQLERRM
    );
END;
$$;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.criar_agendamento_ordem_chegada TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_agendamento_ordem_chegada TO service_role;