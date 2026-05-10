-- [Override profissional - Fase 1.2] validar_limite_recurso v3 — aceita p_force opcional.
--
-- Quando p_force=true: retorna disponivel=true mesmo sem distribuição,
-- com flag forced=true e motivo='forçado'.
-- Quando p_force=false (default): comportamento v2 mantido.
--
-- LLM/scheduling-api NUNCA passa p_force=true.
-- Recepção passa p_force=true APENAS quando user clica "Forçar com motivo".

DROP FUNCTION IF EXISTS public.validar_limite_recurso(uuid, uuid, date, uuid);

CREATE OR REPLACE FUNCTION public.validar_limite_recurso(
  p_atendimento_id uuid,
  p_medico_id uuid,
  p_data_agendamento date,
  p_cliente_id uuid,
  p_force boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
AS $function$
DECLARE
  v_atendimento_nome TEXT;
  v_recurso_nome TEXT;
  v_recurso_id UUID;
  v_dia_semana INTEGER;
  v_distribuicao RECORD;
  v_medico_nome TEXT;
  v_medico_distribuicao_nome TEXT;
  v_limite INTEGER := 0;
  v_agendados INTEGER := 0;
BEGIN
  SELECT nome INTO v_atendimento_nome FROM atendimentos WHERE id = p_atendimento_id AND cliente_id = p_cliente_id;
  IF v_atendimento_nome IS NULL THEN
    RETURN json_build_object('disponivel', true, 'recurso_nome', null,
      'motivo', 'Atendimento não encontrado ou não é recurso limitado');
  END IF;

  v_recurso_nome := CASE
    WHEN UPPER(v_atendimento_nome) LIKE '%MAPA%' THEN 'MAPA'
    WHEN UPPER(v_atendimento_nome) LIKE '%HOLTER%' THEN 'HOLTER'
    WHEN UPPER(v_atendimento_nome) LIKE '%ECG%' OR UPPER(v_atendimento_nome) LIKE '%ELETROCARDIOGRAMA%' THEN 'ECG'
    ELSE NULL
  END;
  IF v_recurso_nome IS NULL THEN
    RETURN json_build_object('disponivel', true, 'recurso_nome', null, 'motivo', 'Não é recurso limitado');
  END IF;

  SELECT id INTO v_recurso_id FROM recursos_equipamentos
  WHERE UPPER(nome) = v_recurso_nome AND cliente_id = p_cliente_id AND ativo = true;
  IF v_recurso_id IS NULL THEN
    RETURN json_build_object('disponivel', true, 'recurso_nome', v_recurso_nome,
      'motivo', 'Recurso não configurado no sistema - permitindo agendamento');
  END IF;

  v_dia_semana := EXTRACT(DOW FROM p_data_agendamento)::INTEGER;
  SELECT nome INTO v_medico_nome FROM medicos WHERE id = p_medico_id;

  SELECT d.* INTO v_distribuicao
  FROM distribuicao_recursos d
  WHERE d.recurso_id = v_recurso_id AND d.dia_semana = v_dia_semana
    AND d.ativo = true AND d.cliente_id = p_cliente_id
    AND (
      d.medico_id = p_medico_id
      OR d.medico_id IN (SELECT medico_id FROM medico_atendimento
                         WHERE atendimento_id = p_atendimento_id AND ativo = true)
    )
  ORDER BY CASE WHEN d.medico_id = p_medico_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_distribuicao IS NULL THEN
    IF p_force THEN
      RETURN json_build_object(
        'disponivel', true, 'forced', true,
        'recurso_nome', v_recurso_nome, 'vagas_usadas', null, 'vagas_total', null,
        'medico_nome', v_medico_nome, 'data', p_data_agendamento,
        'motivo', format('%s forçado para %s — fora do dia regular', v_recurso_nome, v_medico_nome)
      );
    END IF;
    RETURN json_build_object(
      'disponivel', false, 'recurso_nome', v_recurso_nome,
      'vagas_usadas', 0, 'vagas_total', 0, 'medico_nome', v_medico_nome,
      'data', p_data_agendamento,
      'motivo', format('%s não disponível para %s neste dia da semana', v_recurso_nome, v_medico_nome)
    );
  END IF;

  v_limite := COALESCE(v_distribuicao.quantidade, 0);
  SELECT nome INTO v_medico_distribuicao_nome FROM medicos WHERE id = v_distribuicao.medico_id;

  SELECT COUNT(*) INTO v_agendados
  FROM agendamentos a JOIN atendimentos at ON a.atendimento_id = at.id
  WHERE a.data_agendamento = p_data_agendamento
    AND a.status IN ('agendado', 'confirmado')
    AND a.cliente_id = p_cliente_id
    AND (UPPER(at.nome) LIKE '%' || v_recurso_nome || '%'
      OR (v_recurso_nome = 'ECG' AND UPPER(at.nome) LIKE '%ELETROCARDIOGRAMA%'))
    AND (a.medico_id = v_distribuicao.medico_id
      OR EXISTS (SELECT 1 FROM medico_atendimento ma
                 WHERE ma.atendimento_id = a.atendimento_id
                   AND ma.medico_id = v_distribuicao.medico_id AND ma.ativo = true));

  IF v_agendados >= v_limite THEN
    IF p_force THEN
      RETURN json_build_object(
        'disponivel', true, 'forced', true,
        'recurso_nome', v_recurso_nome, 'vagas_usadas', v_agendados, 'vagas_total', v_limite,
        'medico_nome', v_medico_distribuicao_nome, 'data', p_data_agendamento,
        'motivo', format('%s forçado — limite excedido (%s/%s)', v_recurso_nome, v_agendados, v_limite)
      );
    END IF;
    RETURN json_build_object(
      'disponivel', false, 'recurso_nome', v_recurso_nome,
      'vagas_usadas', v_agendados, 'vagas_total', v_limite,
      'medico_nome', v_medico_distribuicao_nome, 'data', p_data_agendamento,
      'motivo', format('Limite de %s atingido para %s em %s (%s/%s vagas ocupadas)',
        v_recurso_nome, v_medico_distribuicao_nome,
        TO_CHAR(p_data_agendamento, 'DD/MM/YYYY'), v_agendados, v_limite)
    );
  END IF;

  RETURN json_build_object(
    'disponivel', true, 'recurso_nome', v_recurso_nome,
    'vagas_usadas', v_agendados, 'vagas_total', v_limite, 'vagas_restantes', v_limite - v_agendados,
    'medico_nome', v_medico_distribuicao_nome, 'data', p_data_agendamento,
    'motivo', format('%s disponível: %s/%s vagas ocupadas', v_recurso_nome, v_agendados, v_limite)
  );
END;
$function$;
