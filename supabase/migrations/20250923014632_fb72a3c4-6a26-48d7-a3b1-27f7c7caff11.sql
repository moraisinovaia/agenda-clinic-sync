-- ===================================================================
-- FINALIZAR FASE 1: SISTEMA MULTI-CLÍNICA
-- ===================================================================

-- 1. Atualizar agendamentos existentes com cliente_id
UPDATE public.agendamentos 
SET cliente_id = (
  SELECT p.cliente_id 
  FROM public.pacientes p 
  WHERE p.id = agendamentos.paciente_id
  LIMIT 1
) 
WHERE cliente_id IS NULL;

-- 2. Tornar cliente_id NOT NULL na tabela agendamentos
ALTER TABLE public.agendamentos 
ALTER COLUMN cliente_id SET NOT NULL;

-- 3. Aplicar RLS definitivo para agendamentos
DROP POLICY IF EXISTS "Agendamentos - acesso temporário" ON public.agendamentos;

-- Política para visualização - apenas da própria clínica
CREATE POLICY "Agendamentos - visualizar da clínica" 
ON public.agendamentos 
FOR SELECT 
USING (cliente_id = get_user_cliente_id());

-- Política para inserção - apenas na própria clínica
CREATE POLICY "Agendamentos - criar na clínica" 
ON public.agendamentos 
FOR INSERT 
WITH CHECK (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- Política para atualização - apenas da própria clínica
CREATE POLICY "Agendamentos - atualizar da clínica" 
ON public.agendamentos 
FOR UPDATE 
USING (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- Política para exclusão - apenas da própria clínica
CREATE POLICY "Agendamentos - deletar da clínica" 
ON public.agendamentos 
FOR DELETE 
USING (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- 4. Atualizar função criar_agendamento_atomico para incluir cliente_id
CREATE OR REPLACE FUNCTION public.criar_agendamento_atomico(
  p_nome_completo text, 
  p_data_nascimento date, 
  p_convenio text, 
  p_telefone text, 
  p_celular text, 
  p_medico_id uuid, 
  p_atendimento_id uuid, 
  p_data_agendamento date, 
  p_hora_agendamento time without time zone, 
  p_observacoes text DEFAULT NULL::text, 
  p_criado_por text DEFAULT 'Recepcionista'::text, 
  p_criado_por_user_id uuid DEFAULT NULL::uuid, 
  p_agendamento_id_edicao uuid DEFAULT NULL::uuid, 
  p_force_update_patient boolean DEFAULT false, 
  p_force_conflict boolean DEFAULT false
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_paciente_id UUID;
  v_agendamento_id UUID;
  v_doctor_record RECORD;
  v_patient_age INTEGER;
  v_blocked_check INTEGER;
  v_conflict_result JSON;
  v_criado_por_nome TEXT;
  current_time_brazil TIMESTAMP WITH TIME ZONE;
  appointment_datetime TIMESTAMP WITH TIME ZONE;
  v_existing_patient_record RECORD;
  v_is_editing BOOLEAN := p_agendamento_id_edicao IS NOT NULL;
  v_warnings TEXT[] := '{}';
  v_atendimento_check INTEGER;
  v_age_note TEXT := '';
  v_cliente_id UUID;
BEGIN
  -- Obter cliente_id do usuário atual
  SELECT get_user_cliente_id() INTO v_cliente_id;
  
  IF v_cliente_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não possui cliente associado');
  END IF;

  IF p_atendimento_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tipo de atendimento é obrigatório');
  END IF;

  SELECT COUNT(*) INTO v_atendimento_check
  FROM public.atendimentos 
  WHERE id = p_atendimento_id AND ativo = true AND cliente_id = v_cliente_id;
  
  IF v_atendimento_check = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Tipo de atendimento inválido ou não pertence à sua clínica');
  END IF;

  IF p_medico_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_atendimento_check
    FROM public.atendimentos 
    WHERE id = p_atendimento_id 
      AND (medico_id = p_medico_id OR medico_id IS NULL)
      AND ativo = true
      AND cliente_id = v_cliente_id;
    
    IF v_atendimento_check = 0 THEN
      RETURN json_build_object('success', false, 'error', 'Este tipo de atendimento não está disponível para o médico selecionado');
    END IF;
  END IF;

  current_time_brazil := now() AT TIME ZONE 'America/Sao_Paulo';
  appointment_datetime := (p_data_agendamento::text || ' ' || p_hora_agendamento::text)::timestamp AT TIME ZONE 'America/Sao_Paulo';

  -- Validar conflito (somente bloqueia se não for forçado)
  IF NOT p_force_conflict THEN
    SELECT public.validar_conflito_agendamento(
      p_medico_id, p_data_agendamento, p_hora_agendamento, p_agendamento_id_edicao
    ) INTO v_conflict_result;

    IF (v_conflict_result->>'has_conflict')::boolean = true THEN
      RETURN json_build_object(
        'success', false,
        'conflict_detected', true,
        'conflict_message', v_conflict_result->>'message',
        'conflict_details', v_conflict_result,
        'message', 'Horário ocupado - confirme para prosseguir'
      );
    END IF;
  END IF;

  -- Buscar nome real do usuário
  IF p_criado_por_user_id IS NOT NULL THEN
    SELECT nome INTO v_criado_por_nome
    FROM public.profiles WHERE user_id = p_criado_por_user_id LIMIT 1;
    v_criado_por_nome := COALESCE(v_criado_por_nome, p_criado_por);
  ELSE
    v_criado_por_nome := p_criado_por;
  END IF;

  -- Médico ativo e restrições (apenas da mesma clínica)
  SELECT m.*, m.ativo, m.idade_minima, m.idade_maxima, m.convenios_aceitos
  INTO v_doctor_record
  FROM public.medicos m
  WHERE m.id = p_medico_id AND m.cliente_id = v_cliente_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Médico não encontrado ou não pertence à sua clínica');
  END IF;
  
  IF NOT v_doctor_record.ativo THEN
    RETURN json_build_object('success', false, 'error', 'Médico não está ativo');
  END IF;

  -- Bloqueios de agenda
  SELECT COUNT(*) INTO v_blocked_check
  FROM public.bloqueios_agenda
  WHERE medico_id = p_medico_id
    AND status = 'ativo'
    AND cliente_id = v_cliente_id
    AND p_data_agendamento BETWEEN data_inicio AND data_fim;
  
  IF v_blocked_check > 0 THEN
    RETURN json_build_object('success', false, 'error', 'A agenda está bloqueada nesta data');
  END IF;

  -- Data/hora no passado (só para novos)
  IF appointment_datetime < (current_time_brazil + interval '1 hour') AND NOT v_is_editing THEN
    RETURN json_build_object('success', false, 'error', 'Agendamento deve ser feito com pelo menos 1 hora de antecedência');
  END IF;
  
  -- Idade: somente AVISO
  SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_data_nascimento))::INTEGER
  INTO v_patient_age;
  
  IF v_doctor_record.idade_minima IS NOT NULL AND v_patient_age < v_doctor_record.idade_minima THEN
    v_warnings := array_append(v_warnings, 
      'ATENÇÃO: Paciente com ' || v_patient_age || ' anos está abaixo da idade mínima (' || v_doctor_record.idade_minima || ' anos) para este médico');
    v_age_note := v_age_note || ' [Idade ' || v_patient_age || ' anos - abaixo do padrão ' || v_doctor_record.idade_minima || ' anos]';
  END IF;
  
  IF v_doctor_record.idade_maxima IS NOT NULL AND v_patient_age > v_doctor_record.idade_maxima THEN
    v_warnings := array_append(v_warnings, 
      'ATENÇÃO: Paciente com ' || v_patient_age || ' anos está acima da idade máxima (' || v_doctor_record.idade_maxima || ' anos) para este médico');
    v_age_note := v_age_note || ' [Idade ' || v_patient_age || ' anos - acima do padrão ' || v_doctor_record.idade_maxima || ' anos]';
  END IF;
  
  IF v_doctor_record.convenios_aceitos IS NOT NULL AND 
     array_length(v_doctor_record.convenios_aceitos, 1) > 0 AND
     NOT (p_convenio = ANY(v_doctor_record.convenios_aceitos)) THEN
    v_warnings := array_append(v_warnings, 
      'ATENÇÃO: Convênio "' || p_convenio || '" pode não ser aceito por este médico');
  END IF;

  -- Gerenciar paciente (buscar/atualizar/criar) - apenas da mesma clínica
  IF v_is_editing THEN
    SELECT paciente_id INTO v_paciente_id FROM public.agendamentos WHERE id = p_agendamento_id_edicao AND cliente_id = v_cliente_id;
    IF v_paciente_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Agendamento não encontrado para edição ou não pertence à sua clínica');
    END IF;
    UPDATE public.pacientes 
    SET nome_completo = p_nome_completo,
        data_nascimento = p_data_nascimento,
        convenio = p_convenio,
        telefone = COALESCE(p_telefone, telefone),
        celular = COALESCE(p_celular, celular),
        updated_at = NOW()
    WHERE id = v_paciente_id AND cliente_id = v_cliente_id;
  ELSE
    SELECT * INTO v_existing_patient_record
    FROM public.pacientes
    WHERE LOWER(nome_completo) = LOWER(p_nome_completo)
      AND data_nascimento = p_data_nascimento
      AND convenio = p_convenio
      AND cliente_id = v_cliente_id
    LIMIT 1;
    
    IF v_existing_patient_record.id IS NOT NULL THEN
      v_paciente_id := v_existing_patient_record.id;
      IF p_force_update_patient OR 
         v_existing_patient_record.telefone != p_telefone OR 
         v_existing_patient_record.celular != p_celular THEN
        UPDATE public.pacientes 
        SET telefone = COALESCE(p_telefone, telefone),
            celular = COALESCE(p_celular, celular),
            updated_at = NOW()
        WHERE id = v_paciente_id;
      END IF;
    ELSE
      INSERT INTO public.pacientes (nome_completo, data_nascimento, convenio, telefone, celular, cliente_id)
      VALUES (p_nome_completo, p_data_nascimento, p_convenio, p_telefone, COALESCE(p_celular, ''), v_cliente_id)
      RETURNING id INTO v_paciente_id;
    END IF;
  END IF;

  -- Criar/atualizar agendamento com notas e cliente_id
  IF v_is_editing THEN
    UPDATE public.agendamentos 
    SET medico_id = p_medico_id,
        atendimento_id = p_atendimento_id,
        data_agendamento = p_data_agendamento,
        hora_agendamento = p_hora_agendamento,
        convenio = p_convenio,
        observacoes = CASE 
          WHEN p_force_conflict THEN COALESCE(p_observacoes, '') || ' [AGENDAMENTO FORÇADO COM CONFLITO]' || v_age_note
          ELSE COALESCE(p_observacoes, '') || v_age_note
        END,
        updated_at = NOW()
    WHERE id = p_agendamento_id_edicao AND cliente_id = v_cliente_id
    RETURNING id INTO v_agendamento_id;
  ELSE
    INSERT INTO public.agendamentos (
      paciente_id, medico_id, atendimento_id, data_agendamento, hora_agendamento,
      convenio, observacoes, criado_por, criado_por_user_id, status, cliente_id
    ) VALUES (
      v_paciente_id, p_medico_id, p_atendimento_id, p_data_agendamento, p_hora_agendamento,
      p_convenio,
      CASE WHEN p_force_conflict THEN COALESCE(p_observacoes, '') || ' [AGENDAMENTO FORÇADO COM CONFLITO]' || v_age_note
           ELSE COALESCE(p_observacoes, '') || v_age_note END,
      v_criado_por_nome, p_criado_por_user_id, 'agendado', v_cliente_id
    ) RETURNING id INTO v_agendamento_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'agendamento_id', v_agendamento_id,
    'paciente_id', v_paciente_id,
    'criado_por_usado', v_criado_por_nome,
    'is_editing', v_is_editing,
    'forced_conflict', p_force_conflict,
    'warnings', CASE WHEN array_length(v_warnings, 1) > 0 THEN v_warnings ELSE NULL END,
    'message', CASE 
      WHEN v_is_editing THEN 'Agendamento atualizado com sucesso' 
      WHEN p_force_conflict THEN 'Agendamento criado com conflito forçado'
      WHEN array_length(v_warnings, 1) > 0 THEN 'Agendamento criado com observações de idade'
      ELSE 'Agendamento criado com sucesso' 
    END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erro interno: ' || SQLERRM);
END;
$function$;

-- 5. Log de conclusão da Fase 1
INSERT INTO public.system_logs (
  timestamp,
  level,
  message,
  context
) VALUES (
  now(),
  'info',
  'FASE 1 CONCLUÍDA: Sistema multi-clínica implementado com sucesso. Todas as tabelas principais agora possuem cliente_id e RLS adequado.',
  'MULTI_CLINIC_PHASE_1_COMPLETE'
);

-- ===================================================================
-- FASE 1 CONCLUÍDA ✅
-- ===================================================================
-- ✅ Tabela clientes criada
-- ✅ cliente_id adicionado a todas as tabelas principais
-- ✅ Dados migrados corretamente
-- ✅ Foreign keys configuradas
-- ✅ Função get_user_cliente_id() criada
-- ✅ RLS implementado em todas as tabelas
-- ✅ Hooks atualizados para incluir cliente_id
-- ✅ Função criar_agendamento_atomico atualizada
-- ✅ Sistema completamente isolado por cliente
-- ===================================================================