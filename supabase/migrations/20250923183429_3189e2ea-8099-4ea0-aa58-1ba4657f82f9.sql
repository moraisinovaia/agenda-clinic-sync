-- Corrigir search_path em todas as funções críticas
CREATE OR REPLACE FUNCTION public.sync_medico_nome_atendimentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.medico_id IS DISTINCT FROM NEW.medico_id) THEN
    IF NEW.medico_id IS NOT NULL THEN
      SELECT nome INTO NEW.medico_nome 
      FROM public.medicos 
      WHERE id = NEW.medico_id;
    ELSE
      NEW.medico_nome = NULL;
    END IF;
  END IF;
  
  IF TG_OP = 'INSERT' AND NEW.medico_id IS NOT NULL THEN
    SELECT nome INTO NEW.medico_nome 
    FROM public.medicos 
    WHERE id = NEW.medico_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_atendimentos_when_medico_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.atendimentos 
  SET medico_nome = NEW.nome 
  WHERE medico_id = NEW.id;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_ipado_medico_nome_atendimentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.medico_id IS DISTINCT FROM NEW.medico_id) THEN
    IF NEW.medico_id IS NOT NULL THEN
      SELECT nome INTO NEW.medico_nome 
      FROM public.ipado_medicos 
      WHERE id = NEW.medico_id;
    ELSE
      NEW.medico_nome = NULL;
    END IF;
  END IF;
  
  IF TG_OP = 'INSERT' AND NEW.medico_id IS NOT NULL THEN
    SELECT nome INTO NEW.medico_nome 
    FROM public.ipado_medicos 
    WHERE id = NEW.medico_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_ipado_atendimentos_when_medico_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ipado_atendimentos 
  SET medico_nome = NEW.nome 
  WHERE medico_id = NEW.id;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_patient_age_for_doctor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  patient_age INTEGER;
  doctor_min_age INTEGER;
  doctor_max_age INTEGER;
  age_note TEXT := '';
BEGIN
  SELECT EXTRACT(YEAR FROM AGE(current_date, p.data_nascimento))::INTEGER
  INTO patient_age
  FROM public.pacientes p
  WHERE p.id = NEW.paciente_id;
  
  SELECT m.idade_minima, m.idade_maxima
  INTO doctor_min_age, doctor_max_age
  FROM public.medicos m
  WHERE m.id = NEW.medico_id;
  
  IF doctor_min_age IS NOT NULL AND patient_age < doctor_min_age THEN
    age_note := age_note || format(' [Idade %s anos - abaixo do padrão %s anos]', patient_age, doctor_min_age);
  END IF;
  
  IF doctor_max_age IS NOT NULL AND patient_age > doctor_max_age THEN
    age_note := age_note || format(' [Idade %s anos - acima do padrão %s anos]', patient_age, doctor_max_age);
  END IF;

  IF age_note <> '' THEN
    NEW.observacoes := coalesce(NEW.observacoes, '') || age_note;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validar_limite_agendamentos_medico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  limite_diario INTEGER := 40;
  total_agendamentos INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO total_agendamentos
  FROM public.agendamentos
  WHERE medico_id = NEW.medico_id
    AND data_agendamento = NEW.data_agendamento
    AND status IN ('agendado', 'confirmado');
  
  IF total_agendamentos >= limite_diario THEN
    RAISE EXCEPTION 'Limite de % agendamentos por dia excedido para este médico', limite_diario;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_patient_insurance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  patient_insurance TEXT;
  doctor_insurances TEXT[];
BEGIN
  SELECT p.convenio
  INTO patient_insurance
  FROM public.pacientes p
  WHERE p.id = NEW.paciente_id;
  
  SELECT m.convenios_aceitos
  INTO doctor_insurances
  FROM public.medicos m
  WHERE m.id = NEW.medico_id;
  
  IF doctor_insurances IS NOT NULL AND array_length(doctor_insurances, 1) > 0 THEN
    IF NOT (patient_insurance = ANY(doctor_insurances)) THEN
      RAISE EXCEPTION 'Convênio "%" não é aceito por este médico', patient_insurance;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_doctor_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doctor_active BOOLEAN;
BEGIN
  SELECT m.ativo
  INTO doctor_active
  FROM public.medicos m
  WHERE m.id = NEW.medico_id;
  
  IF NOT doctor_active THEN
    RAISE EXCEPTION 'Não é possível agendar com médico inativo';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.processar_fila_cancelamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fila_record RECORD;
BEGIN
  IF NEW.status = 'cancelado' AND OLD.status != 'cancelado' THEN
    
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
    
    IF FOUND THEN
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

CREATE OR REPLACE FUNCTION public.processar_bloqueio_agenda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agendamento_record RECORD;
  total_cancelados INTEGER := 0;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'ativo' THEN
    
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
      UPDATE public.agendamentos 
      SET status = 'cancelado_bloqueio',
          observacoes = COALESCE(observacoes, '') || ' - Cancelado por bloqueio de agenda: ' || NEW.motivo,
          updated_at = now()
      WHERE id = agendamento_record.id;
      
      total_cancelados := total_cancelados + 1;
      
      RAISE NOTICE 'Agendamento % cancelado por bloqueio para paciente %', 
        agendamento_record.id, agendamento_record.nome_completo;
    END LOOP;
    
    RAISE NOTICE 'Bloqueio % processado: % agendamentos cancelados', NEW.id, total_cancelados;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_agendamentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id TEXT;
BEGIN
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