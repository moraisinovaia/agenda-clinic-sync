-- Dropar a função existente (necessário para mudar assinatura)
DROP FUNCTION IF EXISTS public.atualizar_medico(uuid, json, uuid[]);
DROP FUNCTION IF EXISTS public.atualizar_medico(uuid, json);

-- Recriar a função com JSONB em vez de JSON
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
  v_updated_medico RECORD;
  v_atendimento_id UUID;
BEGIN
  -- Obter cliente_id do usuário
  v_cliente_id := get_user_cliente_id();
  
  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem cliente_id definido';
  END IF;

  -- Verificar se o médico pertence ao mesmo cliente
  IF NOT EXISTS (
    SELECT 1 FROM public.medicos 
    WHERE id = p_medico_id AND cliente_id = v_cliente_id
  ) THEN
    RAISE EXCEPTION 'Médico não encontrado ou sem permissão';
  END IF;

  -- Atualizar dados do médico
  UPDATE public.medicos
  SET
    nome = COALESCE(p_dados->>'nome', nome),
    especialidade = COALESCE(p_dados->>'especialidade', especialidade),
    ativo = COALESCE((p_dados->>'ativo')::boolean, ativo),
    convenios_aceitos = CASE 
      WHEN p_dados ? 'convenios_aceitos' THEN 
        ARRAY(SELECT jsonb_array_elements_text(p_dados->'convenios_aceitos'))
      ELSE convenios_aceitos 
    END,
    idade_minima = CASE 
      WHEN p_dados ? 'idade_minima' THEN (p_dados->>'idade_minima')::integer 
      ELSE idade_minima 
    END,
    idade_maxima = CASE 
      WHEN p_dados ? 'idade_maxima' THEN (p_dados->>'idade_maxima')::integer 
      ELSE idade_maxima 
    END,
    observacoes = COALESCE(p_dados->>'observacoes', observacoes)
  WHERE id = p_medico_id
  RETURNING * INTO v_updated_medico;

  -- Atualizar atendimentos vinculados se fornecidos
  IF p_atendimentos_ids IS NOT NULL THEN
    -- Remover vínculos anteriores (definir medico_id como NULL nos atendimentos antigos)
    UPDATE public.atendimentos
    SET medico_id = NULL
    WHERE medico_id = p_medico_id AND cliente_id = v_cliente_id;
    
    -- Adicionar novos vínculos
    FOREACH v_atendimento_id IN ARRAY p_atendimentos_ids
    LOOP
      UPDATE public.atendimentos
      SET medico_id = p_medico_id
      WHERE id = v_atendimento_id AND cliente_id = v_cliente_id;
    END LOOP;
  END IF;

  RETURN json_build_object(
    'success', true,
    'medico_id', p_medico_id,
    'message', 'Médico atualizado com sucesso'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.atualizar_medico(uuid, jsonb, uuid[]) TO authenticated;