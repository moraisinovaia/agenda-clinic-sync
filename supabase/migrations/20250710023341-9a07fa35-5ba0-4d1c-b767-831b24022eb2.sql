
-- Função para criação atômica de agendamentos com bloqueios
CREATE OR REPLACE FUNCTION public.criar_agendamento_atomico(
  p_nome_completo TEXT,
  p_data_nascimento DATE,
  p_convenio TEXT,
  p_telefone TEXT,
  p_celular TEXT,
  p_medico_id UUID,
  p_atendimento_id UUID,
  p_data_agendamento DATE,
  p_hora_agendamento TIME,
  p_observacoes TEXT DEFAULT NULL,
  p_criado_por TEXT DEFAULT 'recepcionista',
  p_criado_por_user_id UUID DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
AS $$
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
  
  -- 10. Criar agendamento
  INSERT INTO public.agendamentos (
    paciente_id,
    medico_id,
    atendimento_id,
    data_agendamento,
    hora_agendamento,
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
$$;

-- Índices para otimizar performance em consultas concorrentes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agendamentos_conflito 
ON public.agendamentos (medico_id, data_agendamento, hora_agendamento, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agendamentos_medico_data 
ON public.agendamentos (medico_id, data_agendamento);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bloqueios_agenda_medico_data 
ON public.bloqueios_agenda (medico_id, data_inicio, data_fim, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pacientes_busca 
ON public.pacientes (LOWER(nome_completo), data_nascimento, convenio);

-- Função para buscar agendamentos com otimização
CREATE OR REPLACE FUNCTION public.buscar_agendamentos_otimizado()
RETURNS TABLE (
  id uuid,
  paciente_id uuid,
  medico_id uuid,
  atendimento_id uuid,
  data_agendamento date,
  hora_agendamento time,
  status text,
  observacoes text,
  created_at timestamptz,
  updated_at timestamptz,
  criado_por text,
  criado_por_user_id uuid,
  paciente_nome text,
  paciente_convenio text,
  paciente_celular text,
  medico_nome text,
  medico_especialidade text,
  atendimento_nome text,
  atendimento_tipo text
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    a.id,
    a.paciente_id,
    a.medico_id,
    a.atendimento_id,
    a.data_agendamento,
    a.hora_agendamento,
    a.status,
    a.observacoes,
    a.created_at,
    a.updated_at,
    a.criado_por,
    a.criado_por_user_id,
    p.nome_completo as paciente_nome,
    p.convenio as paciente_convenio,
    p.celular as paciente_celular,
    m.nome as medico_nome,
    m.especialidade as medico_especialidade,
    at.nome as atendimento_nome,
    at.tipo as atendimento_tipo
  FROM public.agendamentos a
  JOIN public.pacientes p ON a.paciente_id = p.id
  JOIN public.medicos m ON a.medico_id = m.id
  JOIN public.atendimentos at ON a.atendimento_id = at.id
  ORDER BY a.data_agendamento ASC, a.hora_agendamento ASC;
$$;
