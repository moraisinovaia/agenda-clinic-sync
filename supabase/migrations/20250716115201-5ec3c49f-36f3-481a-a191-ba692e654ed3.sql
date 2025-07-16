-- Correção 3: Revisar e corrigir as views com Security Definer
-- Removendo Security Definer das views (não é necessário e causa warnings)

-- Recriar as views sem Security Definer
DROP VIEW IF EXISTS public.vw_agente_alertas;
CREATE VIEW public.vw_agente_alertas AS
SELECT 
    chave,
    valor,
    categoria,
    dados_extras,
    CASE 
        WHEN categoria = 'emergencia' THEN 'alta'
        WHEN categoria = 'aviso' THEN 'media'
        ELSE 'baixa'
    END as prioridade
FROM public.configuracoes_clinica 
WHERE categoria IN ('alerta', 'aviso', 'emergencia')
  AND ativo = true;

DROP VIEW IF EXISTS public.vw_agente_convenios;
CREATE VIEW public.vw_agente_convenios AS
SELECT 
    chave as convenio,
    valor as informacao,
    categoria as tipo,
    dados_extras
FROM public.configuracoes_clinica 
WHERE categoria = 'convenio'
  AND ativo = true;

DROP VIEW IF EXISTS public.vw_agente_medicos;
CREATE VIEW public.vw_agente_medicos AS
SELECT 
    m.nome as medico,
    m.especialidade,
    m.convenios_aceitos,
    m.convenios_restricoes,
    m.horarios,
    m.idade_minima,
    a.nome as nome_atendimento,
    a.tipo as tipo_atendimento,
    a.valor_particular,
    a.coparticipacao_20,
    a.coparticipacao_40,
    a.forma_pagamento,
    a.observacoes as obs_atendimento,
    m.observacoes as obs_medico
FROM public.medicos m
LEFT JOIN public.atendimentos a ON m.id = a.medico_id
WHERE m.ativo = true
  AND (a.ativo = true OR a.id IS NULL);

DROP VIEW IF EXISTS public.vw_agente_preparos;
CREATE VIEW public.vw_agente_preparos AS
SELECT 
    nome,
    exame,
    jejum_horas,
    dias_suspensao,
    medicacao_suspender,
    restricoes_alimentares,
    observacoes_especiais,
    itens_levar,
    instrucoes
FROM public.preparos
ORDER BY nome;

-- Correção 4: Adicionar configurações de segurança para OTP e senhas
-- Inserir configurações de segurança recomendadas

INSERT INTO public.configuracoes_clinica (chave, valor, categoria, ativo, dados_extras) 
VALUES 
    ('security_otp_expiry', '300', 'security', true, '{"description": "OTP expiry time in seconds (5 minutes)"}'),
    ('security_password_policy', 'enabled', 'security', true, '{"min_length": 8, "require_special": true, "require_numbers": true}'),
    ('security_session_timeout', '3600', 'security', true, '{"description": "Session timeout in seconds (1 hour)"}'),
    ('security_max_login_attempts', '5', 'security', true, '{"description": "Maximum failed login attempts before lockout"}')
ON CONFLICT (chave) DO UPDATE SET
    valor = EXCLUDED.valor,
    dados_extras = EXCLUDED.dados_extras,
    updated_at = now();

-- Correção 5: Melhorar as funções de criação de agendamento com melhor tratamento de erros
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
    p_criado_por text DEFAULT 'recepcionista'::text, 
    p_criado_por_user_id uuid DEFAULT NULL::uuid
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_paciente_id UUID;
  v_agendamento_id UUID;
  v_doctor_record RECORD;
  v_patient_age INTEGER;
  v_conflict_check INTEGER;
  v_blocked_check INTEGER;
  v_result JSON;
BEGIN
  -- Iniciar transação explícita para garantir atomicidade
  
  -- 1. Bloquear o horário específico para evitar conflitos
  PERFORM 1 FROM public.agendamentos 
  WHERE medico_id = p_medico_id 
    AND data_agendamento = p_data_agendamento 
    AND hora_agendamento = p_hora_agendamento
  FOR UPDATE;
  
  -- 2. Verificar se médico está ativo e buscar suas restrições
  SELECT m.*, m.ativo, m.idade_minima, m.idade_maxima, m.convenios_aceitos
  INTO v_doctor_record
  FROM public.medicos m
  WHERE m.id = p_medico_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Médico não encontrado';
  END IF;
  
  IF NOT v_doctor_record.ativo THEN
    RAISE EXCEPTION 'Médico não está ativo';
  END IF;
  
  -- 3. Verificar bloqueios de agenda
  SELECT COUNT(*)
  INTO v_blocked_check
  FROM public.bloqueios_agenda
  WHERE medico_id = p_medico_id
    AND status = 'ativo'
    AND p_data_agendamento BETWEEN data_inicio AND data_fim;
  
  IF v_blocked_check > 0 THEN
    RAISE EXCEPTION 'A agenda está bloqueada nesta data';
  END IF;
  
  -- 4. Verificar conflito de horário (já com lock)
  SELECT COUNT(*)
  INTO v_conflict_check
  FROM public.agendamentos
  WHERE medico_id = p_medico_id
    AND data_agendamento = p_data_agendamento
    AND hora_agendamento = p_hora_agendamento
    AND status IN ('agendado', 'confirmado');
  
  IF v_conflict_check > 0 THEN
    RAISE EXCEPTION 'Este horário já está ocupado para o médico selecionado';
  END IF;
  
  -- 5. Validar data/hora não é no passado
  IF (p_data_agendamento::timestamp + p_hora_agendamento) < (now() - interval '1 hour') THEN
    RAISE EXCEPTION 'Não é possível agendar para uma data/hora que já passou';
  END IF;
  
  -- 6. Calcular idade do paciente
  SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_data_nascimento))::INTEGER
  INTO v_patient_age;
  
  -- 7. Validar idade vs médico
  IF v_doctor_record.idade_minima IS NOT NULL AND v_patient_age < v_doctor_record.idade_minima THEN
    RAISE EXCEPTION 'Paciente com % anos está abaixo da idade mínima (% anos) para este médico', 
      v_patient_age, v_doctor_record.idade_minima;
  END IF;
  
  IF v_doctor_record.idade_maxima IS NOT NULL AND v_patient_age > v_doctor_record.idade_maxima THEN
    RAISE EXCEPTION 'Paciente com % anos está acima da idade máxima (% anos) para este médico', 
      v_patient_age, v_doctor_record.idade_maxima;
  END IF;
  
  -- 8. Validar convênio aceito
  IF v_doctor_record.convenios_aceitos IS NOT NULL AND 
     array_length(v_doctor_record.convenios_aceitos, 1) > 0 AND
     NOT (p_convenio = ANY(v_doctor_record.convenios_aceitos)) THEN
    RAISE EXCEPTION 'Convênio "%" não é aceito por este médico', p_convenio;
  END IF;
  
  -- 9. Criar ou buscar paciente existente
  SELECT id INTO v_paciente_id
  FROM public.pacientes
  WHERE LOWER(nome_completo) = LOWER(p_nome_completo)
    AND data_nascimento = p_data_nascimento
    AND convenio = p_convenio
  LIMIT 1;
  
  IF v_paciente_id IS NULL THEN
    -- Criar novo paciente
    INSERT INTO public.pacientes (
      nome_completo,
      data_nascimento,
      convenio,
      telefone,
      celular
    ) VALUES (
      p_nome_completo,
      p_data_nascimento,
      p_convenio,
      p_telefone,
      COALESCE(p_celular, '')
    ) RETURNING id INTO v_paciente_id;
  END IF;
  
  -- 10. Criar agendamento (INCLUINDO O CONVENIO)
  INSERT INTO public.agendamentos (
    paciente_id,
    medico_id,
    atendimento_id,
    data_agendamento,
    hora_agendamento,
    convenio,
    observacoes,
    criado_por,
    criado_por_user_id,
    status
  ) VALUES (
    v_paciente_id,
    p_medico_id,
    p_atendimento_id,
    p_data_agendamento,
    p_hora_agendamento,
    p_convenio,
    p_observacoes,
    p_criado_por,
    p_criado_por_user_id,
    'agendado'
  ) RETURNING id INTO v_agendamento_id;
  
  -- 11. Retornar dados do agendamento criado
  SELECT json_build_object(
    'success', true,
    'agendamento_id', v_agendamento_id,
    'paciente_id', v_paciente_id,
    'message', 'Agendamento criado com sucesso'
  ) INTO v_result;
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Em caso de erro, a transação será automaticamente revertida
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Erro ao criar agendamento: ' || SQLERRM
    );
END;
$function$;