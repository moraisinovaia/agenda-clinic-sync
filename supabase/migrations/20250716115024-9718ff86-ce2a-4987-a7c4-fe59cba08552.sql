-- Correção 2: Continuar corrigindo as demais funções sem search_path

-- Função validate_patient_age_for_doctor
CREATE OR REPLACE FUNCTION public.validate_patient_age_for_doctor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  patient_age INTEGER;
  doctor_min_age INTEGER;
  doctor_max_age INTEGER;
BEGIN
  -- Buscar idade do paciente
  SELECT EXTRACT(YEAR FROM AGE(current_date, p.data_nascimento))::INTEGER
  INTO patient_age
  FROM public.pacientes p
  WHERE p.id = NEW.paciente_id;
  
  -- Buscar restrições de idade do médico
  SELECT m.idade_minima, m.idade_maxima
  INTO doctor_min_age, doctor_max_age
  FROM public.medicos m
  WHERE m.id = NEW.medico_id;
  
  -- Validar idade mínima
  IF doctor_min_age IS NOT NULL AND patient_age < doctor_min_age THEN
    RAISE EXCEPTION 'Paciente com % anos está abaixo da idade mínima (% anos) para este médico', patient_age, doctor_min_age;
  END IF;
  
  -- Validar idade máxima
  IF doctor_max_age IS NOT NULL AND patient_age > doctor_max_age THEN
    RAISE EXCEPTION 'Paciente com % anos está acima da idade máxima (% anos) para este médico', patient_age, doctor_max_age;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Função validate_patient_insurance
CREATE OR REPLACE FUNCTION public.validate_patient_insurance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  patient_insurance TEXT;
  doctor_insurances TEXT[];
BEGIN
  -- Buscar convênio do paciente
  SELECT p.convenio
  INTO patient_insurance
  FROM public.pacientes p
  WHERE p.id = NEW.paciente_id;
  
  -- Buscar convênios aceitos pelo médico
  SELECT m.convenios_aceitos
  INTO doctor_insurances
  FROM public.medicos m
  WHERE m.id = NEW.medico_id;
  
  -- Validar se o convênio é aceito (se há lista de convênios definida)
  IF doctor_insurances IS NOT NULL AND array_length(doctor_insurances, 1) > 0 THEN
    IF NOT (patient_insurance = ANY(doctor_insurances)) THEN
      RAISE EXCEPTION 'Convênio "%" não é aceito por este médico', patient_insurance;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Função validate_doctor_active
CREATE OR REPLACE FUNCTION public.validate_doctor_active()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Função validar_limite_agendamentos_medico
CREATE OR REPLACE FUNCTION public.validar_limite_agendamentos_medico()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  limite_diario INTEGER := 20; -- Máximo 20 pacientes por médico por dia
  total_agendamentos INTEGER;
BEGIN
  -- Contar agendamentos do médico na data
  SELECT COUNT(*)
  INTO total_agendamentos
  FROM public.agendamentos
  WHERE medico_id = NEW.medico_id
    AND data_agendamento = NEW.data_agendamento
    AND status IN ('agendado', 'confirmado');
  
  -- Verificar se excede o limite
  IF total_agendamentos >= limite_diario THEN
    RAISE EXCEPTION 'Limite de % agendamentos por dia excedido para este médico', limite_diario;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Função validar_agendamento_duplicado_paciente
CREATE OR REPLACE FUNCTION public.validar_agendamento_duplicado_paciente()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  agendamentos_conflito INTEGER;
BEGIN
  -- Verificar se paciente já tem agendamento no mesmo horário
  SELECT COUNT(*)
  INTO agendamentos_conflito
  FROM public.agendamentos
  WHERE paciente_id = NEW.paciente_id
    AND data_agendamento = NEW.data_agendamento
    AND hora_agendamento = NEW.hora_agendamento
    AND status IN ('agendado', 'confirmado')
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  -- Se encontrou conflito, impedir
  IF agendamentos_conflito > 0 THEN
    RAISE EXCEPTION 'Paciente já possui agendamento neste horário';
  END IF;
  
  RETURN NEW;
END;
$function$;