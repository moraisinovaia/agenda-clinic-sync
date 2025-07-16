-- Correção dos problemas de segurança críticos
-- 1. Corrigir Views Security Definer
DROP VIEW IF EXISTS vw_agente_alertas;
DROP VIEW IF EXISTS vw_agente_convenios; 
DROP VIEW IF EXISTS vw_agente_medicos;
DROP VIEW IF EXISTS vw_agente_preparos;

-- Recriar views sem SECURITY DEFINER
CREATE VIEW vw_agente_alertas AS
SELECT 
  chave,
  valor,
  categoria,
  dados_extras,
  CASE 
    WHEN categoria = 'security' THEN 'high'
    WHEN categoria = 'alerts' THEN 'medium'
    ELSE 'low'
  END as prioridade
FROM configuracoes_clinica
WHERE ativo = true AND categoria IN ('alerts', 'security');

CREATE VIEW vw_agente_convenios AS
SELECT 
  p.convenio,
  'convenio_info' as tipo,
  CONCAT('Convenio: ', p.convenio, ' - Total pacientes: ', COUNT(*)) as informacao,
  jsonb_build_object('total_pacientes', COUNT(*)) as dados_extras
FROM pacientes p
GROUP BY p.convenio;

CREATE VIEW vw_agente_medicos AS
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
FROM medicos m
LEFT JOIN atendimentos a ON m.id = a.medico_id
WHERE m.ativo = true AND (a.ativo = true OR a.ativo IS NULL);

CREATE VIEW vw_agente_preparos AS
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
FROM preparos;

-- 2. Corrigir funções sem search_path
CREATE OR REPLACE FUNCTION public.audit_agendamentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id TEXT;
BEGIN
  -- Tentar obter o usuário autenticado, senão usar 'system'
  BEGIN
    SELECT COALESCE(auth.uid()::text, 'system') INTO current_user_id;
  EXCEPTION
    WHEN OTHERS THEN
      current_user_id := 'system';
  END;
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.agendamentos_audit (agendamento_id, action, new_data, changed_by)
    VALUES (NEW.id, 'INSERT', to_jsonb(NEW), current_user_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.agendamentos_audit (agendamento_id, action, old_data, new_data, changed_by)
    VALUES (NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), current_user_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.agendamentos_audit (agendamento_id, action, old_data, changed_by)
    VALUES (OLD.id, 'DELETE', to_jsonb(OLD), current_user_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email, role, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'recepcionista'),
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.processar_bloqueio_agenda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  agendamento_record RECORD;
  total_cancelados INTEGER := 0;
BEGIN
  -- Só processa se é um novo bloqueio ativo
  IF TG_OP = 'INSERT' AND NEW.status = 'ativo' THEN
    
    -- Buscar todos os agendamentos afetados pelo bloqueio
    FOR agendamento_record IN
      SELECT a.*, p.nome_completo, p.celular, m.nome as medico_nome, at.nome as atendimento_nome
      FROM public.agendamentos a
      JOIN public.pacientes p ON a.paciente_id = p.id
      JOIN public.medicos m ON a.medico_id = m.id
      JOIN public.atendimentos at ON a.atendimento_id = at.id
      WHERE a.medico_id = NEW.medico_id
        AND a.data_agendamento BETWEEN NEW.data_inicio AND NEW.data_fim
        AND a.status = 'agendado'
    LOOP
      -- Marcar agendamento como cancelado
      UPDATE public.agendamentos 
      SET status = 'cancelado_bloqueio',
          observacoes = COALESCE(observacoes, '') || ' - Cancelado por bloqueio de agenda: ' || NEW.motivo,
          updated_at = now()
      WHERE id = agendamento_record.id;
      
      total_cancelados := total_cancelados + 1;
      
      -- Log para auditoria
      RAISE NOTICE 'Agendamento % cancelado por bloqueio para paciente %', 
        agendamento_record.id, agendamento_record.nome_completo;
    END LOOP;
    
    -- Log do total processado
    RAISE NOTICE 'Bloqueio % processado: % agendamentos cancelados', NEW.id, total_cancelados;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.processar_fila_cancelamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  fila_record RECORD;
BEGIN
  -- Só processa se o agendamento foi cancelado
  IF NEW.status = 'cancelado' AND OLD.status != 'cancelado' THEN
    
    -- Buscar próximo da fila para este médico e data
    SELECT fe.*, p.nome_completo, p.celular, m.nome as medico_nome, a.nome as atendimento_nome
    INTO fila_record
    FROM public.fila_espera fe
    JOIN public.pacientes p ON fe.paciente_id = p.id
    JOIN public.medicos m ON fe.medico_id = m.id
    JOIN public.atendimentos a ON fe.atendimento_id = a.id
    WHERE fe.medico_id = NEW.medico_id
      AND fe.data_preferida <= NEW.data_agendamento
      AND fe.status = 'aguardando'
      AND (fe.data_limite IS NULL OR fe.data_limite >= NEW.data_agendamento)
    ORDER BY fe.prioridade DESC, fe.created_at ASC
    LIMIT 1;
    
    -- Se encontrou alguém na fila, criar notificação
    IF FOUND THEN
      -- Inserir notificação com tempo limite de 2 horas
      INSERT INTO public.fila_notificacoes (
        fila_id,
        horario_disponivel,
        data_agendamento,
        hora_agendamento,
        tempo_limite
      ) VALUES (
        fila_record.id,
        now(),
        NEW.data_agendamento,
        NEW.hora_agendamento,
        now() + interval '2 hours'
      );
      
      -- Atualizar status da fila para notificado
      UPDATE public.fila_espera 
      SET status = 'notificado', 
          ultimo_contato = now(),
          tentativas_contato = tentativas_contato + 1
      WHERE id = fila_record.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_appointment_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Permitir atualizações de status sem validar data
  IF TG_OP = 'UPDATE' AND OLD.data_agendamento = NEW.data_agendamento AND OLD.hora_agendamento = NEW.hora_agendamento THEN
    RETURN NEW;
  END IF;
  
  -- Validar que não é no passado (com tolerância de 1 hora para ajustes)
  IF (NEW.data_agendamento::timestamp + NEW.hora_agendamento::time) < (now() - interval '1 hour') THEN
    RAISE EXCEPTION 'Não é possível agendar para uma data/hora que já passou';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Configurações de segurança para OTP
UPDATE auth.config 
SET 
  otp_exp = 300,  -- 5 minutos
  password_min_length = 8
WHERE true;