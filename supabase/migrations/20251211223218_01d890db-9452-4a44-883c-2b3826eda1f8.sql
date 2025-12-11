-- =====================================================
-- FASE 2: RPCs para Gestão de Médicos por Clínica
-- =====================================================

-- 1. Função para listar médicos de uma clínica
CREATE OR REPLACE FUNCTION public.get_medicos_por_clinica(p_cliente_id UUID)
RETURNS TABLE(
  id UUID,
  nome VARCHAR,
  especialidade VARCHAR,
  ativo BOOLEAN,
  convenios_aceitos TEXT[],
  idade_minima INTEGER,
  idade_maxima INTEGER,
  observacoes TEXT,
  horarios JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se é admin global ou admin_clinica da clínica
  IF NOT (
    has_role(auth.uid(), 'admin') OR 
    has_clinic_admin_access(auth.uid(), p_cliente_id)
  ) THEN
    RAISE EXCEPTION 'Acesso negado: você não tem permissão para visualizar médicos desta clínica';
  END IF;

  RETURN QUERY
  SELECT 
    m.id,
    m.nome,
    m.especialidade,
    m.ativo,
    m.convenios_aceitos,
    m.idade_minima,
    m.idade_maxima,
    m.observacoes,
    m.horarios,
    m.created_at
  FROM medicos m
  WHERE m.cliente_id = p_cliente_id
  ORDER BY m.nome;
END;
$$;

-- 2. Função para criar médico
CREATE OR REPLACE FUNCTION public.criar_medico(
  p_cliente_id UUID,
  p_nome VARCHAR,
  p_especialidade VARCHAR,
  p_convenios_aceitos TEXT[] DEFAULT NULL,
  p_idade_minima INTEGER DEFAULT 0,
  p_idade_maxima INTEGER DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_medico_id UUID;
BEGIN
  -- Verificar se é admin global ou admin_clinica da clínica
  IF NOT (
    has_role(auth.uid(), 'admin') OR 
    has_clinic_admin_access(auth.uid(), p_cliente_id)
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Acesso negado: você não tem permissão para criar médicos nesta clínica'
    );
  END IF;

  -- Validar campos obrigatórios
  IF p_nome IS NULL OR TRIM(p_nome) = '' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Nome do médico é obrigatório'
    );
  END IF;

  IF p_especialidade IS NULL OR TRIM(p_especialidade) = '' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Especialidade é obrigatória'
    );
  END IF;

  -- Criar médico
  INSERT INTO medicos (
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
    TRIM(p_nome),
    TRIM(p_especialidade),
    p_convenios_aceitos,
    COALESCE(p_idade_minima, 0),
    p_idade_maxima,
    p_observacoes,
    true
  )
  RETURNING id INTO v_medico_id;

  RETURN json_build_object(
    'success', true,
    'medico_id', v_medico_id,
    'message', 'Médico criado com sucesso'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- 3. Função para atualizar médico
CREATE OR REPLACE FUNCTION public.atualizar_medico(
  p_medico_id UUID,
  p_dados JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id UUID;
BEGIN
  -- Buscar cliente_id do médico
  SELECT cliente_id INTO v_cliente_id
  FROM medicos
  WHERE id = p_medico_id;

  IF v_cliente_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Médico não encontrado'
    );
  END IF;

  -- Verificar se é admin global ou admin_clinica da clínica do médico
  IF NOT (
    has_role(auth.uid(), 'admin') OR 
    has_clinic_admin_access(auth.uid(), v_cliente_id)
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Acesso negado: você não tem permissão para editar médicos desta clínica'
    );
  END IF;

  -- Atualizar campos fornecidos
  UPDATE medicos
  SET
    nome = COALESCE(p_dados->>'nome', nome),
    especialidade = COALESCE(p_dados->>'especialidade', especialidade),
    ativo = COALESCE((p_dados->>'ativo')::boolean, ativo),
    convenios_aceitos = CASE 
      WHEN p_dados ? 'convenios_aceitos' THEN 
        ARRAY(SELECT jsonb_array_elements_text(p_dados->'convenios_aceitos'))
      ELSE convenios_aceitos 
    END,
    idade_minima = COALESCE((p_dados->>'idade_minima')::integer, idade_minima),
    idade_maxima = CASE 
      WHEN p_dados ? 'idade_maxima' THEN (p_dados->>'idade_maxima')::integer
      ELSE idade_maxima 
    END,
    observacoes = CASE 
      WHEN p_dados ? 'observacoes' THEN p_dados->>'observacoes'
      ELSE observacoes 
    END
  WHERE id = p_medico_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Médico atualizado com sucesso'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.get_medicos_por_clinica(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_medico(UUID, VARCHAR, VARCHAR, TEXT[], INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_medico(UUID, JSONB) TO authenticated;