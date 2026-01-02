-- Atualizar função get_medicos_por_clinica para incluir CRM e RQE
DROP FUNCTION IF EXISTS public.get_medicos_por_clinica(UUID);

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
  created_at TIMESTAMPTZ,
  crm VARCHAR,
  rqe VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar permissão (admin ou admin_clinica do cliente)
  IF NOT (
    public.is_current_user_admin() OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
      AND p.cliente_id = p_cliente_id
      AND p.role = 'admin_clinica'
      AND p.status = 'aprovado'
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado: você não tem permissão para visualizar os médicos desta clínica';
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
    m.created_at,
    m.crm,
    m.rqe
  FROM public.medicos m
  WHERE m.cliente_id = p_cliente_id
  ORDER BY m.nome;
END;
$$;

-- Atualizar função atualizar_medico para aceitar CRM e RQE
CREATE OR REPLACE FUNCTION public.atualizar_medico(
  p_medico_id UUID,
  p_dados JSONB,
  p_atendimentos_ids UUID[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id UUID;
  v_medico_existente RECORD;
  v_atend_id UUID;
BEGIN
  -- Buscar médico existente
  SELECT * INTO v_medico_existente
  FROM public.medicos
  WHERE id = p_medico_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Médico não encontrado');
  END IF;

  v_cliente_id := v_medico_existente.cliente_id;

  -- Verificar permissão
  IF NOT (
    public.is_current_user_admin() OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
      AND p.cliente_id = v_cliente_id
      AND p.role = 'admin_clinica'
      AND p.status = 'aprovado'
    )
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Atualizar médico (incluindo CRM e RQE)
  UPDATE public.medicos SET
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
    END,
    horarios = CASE 
      WHEN p_dados ? 'horarios' THEN p_dados->'horarios'
      ELSE horarios
    END,
    crm = CASE 
      WHEN p_dados ? 'crm' THEN p_dados->>'crm'
      ELSE crm
    END,
    rqe = CASE 
      WHEN p_dados ? 'rqe' THEN p_dados->>'rqe'
      ELSE rqe
    END,
    updated_at = now()
  WHERE id = p_medico_id;

  -- Atualizar atendimentos se fornecidos
  IF p_atendimentos_ids IS NOT NULL THEN
    -- Desvincular todos os atendimentos atuais
    UPDATE public.atendimentos SET medico_id = NULL WHERE medico_id = p_medico_id;
    
    -- Vincular novos atendimentos
    FOREACH v_atend_id IN ARRAY p_atendimentos_ids
    LOOP
      UPDATE public.atendimentos 
      SET medico_id = p_medico_id 
      WHERE id = v_atend_id AND cliente_id = v_cliente_id;
    END LOOP;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Médico atualizado com sucesso',
    'medico_id', p_medico_id
  );
END;
$$;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.get_medicos_por_clinica(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_medico(UUID, JSONB, UUID[]) TO authenticated;