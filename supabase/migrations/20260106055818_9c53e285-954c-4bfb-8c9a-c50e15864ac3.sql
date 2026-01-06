-- Função para validar limite de recursos (MAPA, HOLTER, ECG)
-- Retorna se há vagas disponíveis para o recurso no dia/médico especificado

CREATE OR REPLACE FUNCTION public.validar_limite_recurso(
  p_atendimento_id UUID,
  p_medico_id UUID,
  p_data_agendamento DATE,
  p_cliente_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atendimento_nome TEXT;
  v_recurso_nome TEXT;
  v_recurso_id UUID;
  v_dia_semana INTEGER;
  v_hora_atual TIME;
  v_periodo TEXT;
  v_limite INTEGER := 0;
  v_agendados INTEGER := 0;
  v_distribuicao RECORD;
  v_medico_nome TEXT;
BEGIN
  -- Buscar nome do atendimento
  SELECT nome INTO v_atendimento_nome
  FROM atendimentos
  WHERE id = p_atendimento_id AND cliente_id = p_cliente_id;
  
  IF v_atendimento_nome IS NULL THEN
    RETURN json_build_object(
      'disponivel', true,
      'recurso_nome', null,
      'motivo', 'Atendimento não encontrado ou não é recurso limitado'
    );
  END IF;
  
  -- Identificar se é um recurso controlado (MAPA, HOLTER, ECG)
  v_recurso_nome := CASE
    WHEN UPPER(v_atendimento_nome) LIKE '%MAPA%' THEN 'MAPA'
    WHEN UPPER(v_atendimento_nome) LIKE '%HOLTER%' THEN 'HOLTER'
    WHEN UPPER(v_atendimento_nome) LIKE '%ECG%' OR UPPER(v_atendimento_nome) LIKE '%ELETROCARDIOGRAMA%' THEN 'ECG'
    ELSE NULL
  END;
  
  -- Se não é recurso controlado, permitir
  IF v_recurso_nome IS NULL THEN
    RETURN json_build_object(
      'disponivel', true,
      'recurso_nome', null,
      'motivo', 'Não é recurso limitado'
    );
  END IF;
  
  -- Buscar ID do recurso
  SELECT id INTO v_recurso_id
  FROM recursos_equipamentos
  WHERE UPPER(nome) = v_recurso_nome 
    AND cliente_id = p_cliente_id 
    AND ativo = true;
  
  IF v_recurso_id IS NULL THEN
    -- Recurso não configurado, permitir agendamento
    RETURN json_build_object(
      'disponivel', true,
      'recurso_nome', v_recurso_nome,
      'motivo', 'Recurso não configurado no sistema - permitindo agendamento'
    );
  END IF;
  
  -- Calcular dia da semana (0=Domingo, 1=Segunda, etc.)
  v_dia_semana := EXTRACT(DOW FROM p_data_agendamento)::INTEGER;
  
  -- Buscar nome do médico
  SELECT nome INTO v_medico_nome
  FROM medicos
  WHERE id = p_medico_id;
  
  -- Buscar distribuição de recursos para este médico/dia
  SELECT * INTO v_distribuicao
  FROM distribuicao_recursos
  WHERE recurso_id = v_recurso_id
    AND medico_id = p_medico_id
    AND dia_semana = v_dia_semana
    AND ativo = true
    AND cliente_id = p_cliente_id;
  
  IF v_distribuicao IS NULL THEN
    -- Médico não tem configuração para este dia, bloquear
    RETURN json_build_object(
      'disponivel', false,
      'recurso_nome', v_recurso_nome,
      'vagas_usadas', 0,
      'vagas_total', 0,
      'medico_nome', v_medico_nome,
      'data', p_data_agendamento,
      'motivo', format('%s não disponível para %s neste dia da semana', v_recurso_nome, v_medico_nome)
    );
  END IF;
  
  v_limite := COALESCE(v_distribuicao.quantidade, 0);
  
  -- Contar agendamentos existentes para este recurso/médico/data
  SELECT COUNT(*) INTO v_agendados
  FROM agendamentos a
  JOIN atendimentos at ON a.atendimento_id = at.id
  WHERE a.medico_id = p_medico_id
    AND a.data_agendamento = p_data_agendamento
    AND a.status IN ('agendado', 'confirmado')
    AND a.cliente_id = p_cliente_id
    AND (
      UPPER(at.nome) LIKE '%' || v_recurso_nome || '%'
      OR (v_recurso_nome = 'ECG' AND UPPER(at.nome) LIKE '%ELETROCARDIOGRAMA%')
    );
  
  -- Verificar se há vagas
  IF v_agendados >= v_limite THEN
    RETURN json_build_object(
      'disponivel', false,
      'recurso_nome', v_recurso_nome,
      'vagas_usadas', v_agendados,
      'vagas_total', v_limite,
      'medico_nome', v_medico_nome,
      'data', p_data_agendamento,
      'motivo', format('Limite de %s atingido para %s em %s (%s/%s vagas ocupadas)', 
        v_recurso_nome, v_medico_nome, TO_CHAR(p_data_agendamento, 'DD/MM/YYYY'), v_agendados, v_limite)
    );
  END IF;
  
  -- Há vagas disponíveis
  RETURN json_build_object(
    'disponivel', true,
    'recurso_nome', v_recurso_nome,
    'vagas_usadas', v_agendados,
    'vagas_total', v_limite,
    'vagas_restantes', v_limite - v_agendados,
    'medico_nome', v_medico_nome,
    'data', p_data_agendamento,
    'motivo', format('%s disponível: %s/%s vagas ocupadas', v_recurso_nome, v_agendados, v_limite)
  );
END;
$$;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.validar_limite_recurso TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_limite_recurso TO service_role;

-- Adicionar comentário
COMMENT ON FUNCTION public.validar_limite_recurso IS 'Valida se há vagas disponíveis para recursos controlados (MAPA, HOLTER, ECG) antes do agendamento';