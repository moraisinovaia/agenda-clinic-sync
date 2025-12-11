-- Atualizar função criar_medico para suportar atendimentos_ids
CREATE OR REPLACE FUNCTION public.criar_medico(
  p_cliente_id UUID,
  p_nome TEXT,
  p_especialidade TEXT,
  p_convenios_aceitos TEXT[] DEFAULT NULL,
  p_idade_minima INTEGER DEFAULT NULL,
  p_idade_maxima INTEGER DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL,
  p_atendimentos_ids UUID[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_medico_id UUID;
  v_result JSON;
BEGIN
  -- Validações básicas
  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'cliente_id é obrigatório';
  END IF;
  
  IF p_nome IS NULL OR trim(p_nome) = '' THEN
    RAISE EXCEPTION 'Nome do médico é obrigatório';
  END IF;
  
  IF p_especialidade IS NULL OR trim(p_especialidade) = '' THEN
    RAISE EXCEPTION 'Especialidade é obrigatória';
  END IF;
  
  -- Inserir médico
  INSERT INTO public.medicos (
    cliente_id,
    nome,
    especialidade,
    convenios_aceitos,
    idade_minima,
    idade_maxima,
    observacoes,
    ativo
  ) VALUES (
    p_cliente_id,
    trim(p_nome),
    trim(p_especialidade),
    p_convenios_aceitos,
    COALESCE(p_idade_minima, 0),
    p_idade_maxima,
    p_observacoes,
    true
  ) RETURNING id INTO v_medico_id;
  
  -- Vincular atendimentos ao médico
  IF p_atendimentos_ids IS NOT NULL AND array_length(p_atendimentos_ids, 1) > 0 THEN
    UPDATE public.atendimentos 
    SET medico_id = v_medico_id
    WHERE id = ANY(p_atendimentos_ids) 
      AND cliente_id = p_cliente_id;
  END IF;
  
  -- Retornar sucesso
  RETURN json_build_object(
    'success', true,
    'medico_id', v_medico_id,
    'message', 'Médico criado com sucesso'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Erro ao criar médico: ' || SQLERRM
    );
END;
$$;

-- Atualizar função atualizar_medico para suportar atendimentos_ids
CREATE OR REPLACE FUNCTION public.atualizar_medico(
  p_medico_id UUID,
  p_dados JSON,
  p_atendimentos_ids UUID[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cliente_id UUID;
  v_result JSON;
BEGIN
  -- Validações básicas
  IF p_medico_id IS NULL THEN
    RAISE EXCEPTION 'medico_id é obrigatório';
  END IF;
  
  -- Buscar cliente_id do médico
  SELECT cliente_id INTO v_cliente_id
  FROM public.medicos
  WHERE id = p_medico_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Médico não encontrado';
  END IF;
  
  -- Atualizar médico
  UPDATE public.medicos
  SET
    nome = COALESCE((p_dados->>'nome')::TEXT, nome),
    especialidade = COALESCE((p_dados->>'especialidade')::TEXT, especialidade),
    ativo = COALESCE((p_dados->>'ativo')::BOOLEAN, ativo),
    convenios_aceitos = CASE 
      WHEN p_dados ? 'convenios_aceitos' THEN 
        ARRAY(SELECT jsonb_array_elements_text(p_dados->'convenios_aceitos'))
      ELSE convenios_aceitos
    END,
    idade_minima = COALESCE((p_dados->>'idade_minima')::INTEGER, idade_minima),
    idade_maxima = CASE
      WHEN p_dados ? 'idade_maxima' AND p_dados->>'idade_maxima' IS NOT NULL THEN
        (p_dados->>'idade_maxima')::INTEGER
      ELSE idade_maxima
    END,
    observacoes = CASE
      WHEN p_dados ? 'observacoes' THEN (p_dados->>'observacoes')::TEXT
      ELSE observacoes
    END
  WHERE id = p_medico_id;
  
  -- Atualizar vínculos de atendimentos
  IF p_atendimentos_ids IS NOT NULL THEN
    -- Remover médico de atendimentos antigos
    UPDATE public.atendimentos 
    SET medico_id = NULL 
    WHERE medico_id = p_medico_id
      AND cliente_id = v_cliente_id;
    
    -- Vincular novos atendimentos
    IF array_length(p_atendimentos_ids, 1) > 0 THEN
      UPDATE public.atendimentos 
      SET medico_id = p_medico_id
      WHERE id = ANY(p_atendimentos_ids)
        AND cliente_id = v_cliente_id;
    END IF;
  END IF;
  
  -- Retornar sucesso
  RETURN json_build_object(
    'success', true,
    'medico_id', p_medico_id,
    'message', 'Médico atualizado com sucesso'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Erro ao atualizar médico: ' || SQLERRM
    );
END;
$$;