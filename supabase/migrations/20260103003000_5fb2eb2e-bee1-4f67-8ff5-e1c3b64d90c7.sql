-- Dropar funções existentes que precisam mudar assinatura
DROP FUNCTION IF EXISTS public.atualizar_medico(uuid, jsonb, uuid[]);
DROP FUNCTION IF EXISTS public.atualizar_medico(uuid, jsonb);
DROP FUNCTION IF EXISTS public.get_medicos_por_clinica(uuid);

-- Atualizar função atualizar_medico para aceitar novos campos
CREATE OR REPLACE FUNCTION public.atualizar_medico(
  p_medico_id uuid,
  p_dados jsonb,
  p_atendimentos_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
  v_atendimento_id uuid;
BEGIN
  -- Verificar se o médico existe e obter cliente_id
  SELECT cliente_id INTO v_cliente_id
  FROM medicos
  WHERE id = p_medico_id;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Médico não encontrado'
    );
  END IF;

  -- Atualizar o médico com todos os campos possíveis
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
    END,
    crm = CASE 
      WHEN p_dados ? 'crm' THEN p_dados->>'crm'
      ELSE crm 
    END,
    rqe = CASE 
      WHEN p_dados ? 'rqe' THEN p_dados->>'rqe'
      ELSE rqe 
    END,
    telefone_alternativo = CASE 
      WHEN p_dados ? 'telefone_alternativo' THEN p_dados->>'telefone_alternativo'
      ELSE telefone_alternativo 
    END,
    atende_criancas = CASE 
      WHEN p_dados ? 'atende_criancas' THEN (p_dados->>'atende_criancas')::boolean
      ELSE atende_criancas 
    END,
    atende_adultos = CASE 
      WHEN p_dados ? 'atende_adultos' THEN (p_dados->>'atende_adultos')::boolean
      ELSE atende_adultos 
    END,
    convenios_restricoes = CASE 
      WHEN p_dados ? 'convenios_restricoes' THEN p_dados->'convenios_restricoes'
      ELSE convenios_restricoes 
    END,
    horarios = CASE 
      WHEN p_dados ? 'horarios' THEN p_dados->'horarios'
      ELSE horarios 
    END
  WHERE id = p_medico_id;

  -- Atualizar atendimentos vinculados
  IF p_atendimentos_ids IS NOT NULL THEN
    -- Primeiro, desvincular todos os atendimentos atuais
    UPDATE atendimentos
    SET medico_id = NULL
    WHERE medico_id = p_medico_id
    AND cliente_id = v_cliente_id;

    -- Depois, vincular os novos
    FOREACH v_atendimento_id IN ARRAY p_atendimentos_ids
    LOOP
      UPDATE atendimentos 
      SET medico_id = p_medico_id
      WHERE id = v_atendimento_id 
      AND cliente_id = v_cliente_id;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'medico_id', p_medico_id,
    'message', 'Médico atualizado com sucesso'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Atualizar função get_medicos_por_clinica para retornar novos campos
CREATE OR REPLACE FUNCTION public.get_medicos_por_clinica(p_cliente_id uuid)
RETURNS TABLE(
  id uuid,
  nome character varying,
  especialidade character varying,
  ativo boolean,
  convenios_aceitos text[],
  convenios_restricoes jsonb,
  idade_minima integer,
  idade_maxima integer,
  observacoes text,
  horarios jsonb,
  crm character varying,
  rqe character varying,
  telefone_alternativo character varying,
  atende_criancas boolean,
  atende_adultos boolean,
  created_at timestamp without time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.nome,
    m.especialidade,
    m.ativo,
    m.convenios_aceitos,
    m.convenios_restricoes,
    m.idade_minima,
    m.idade_maxima,
    m.observacoes,
    m.horarios,
    m.crm,
    m.rqe,
    m.telefone_alternativo::character varying,
    COALESCE(m.atende_criancas, true) as atende_criancas,
    COALESCE(m.atende_adultos, true) as atende_adultos,
    m.created_at
  FROM medicos m
  WHERE m.cliente_id = p_cliente_id
  ORDER BY m.nome;
END;
$$;