-- Fix validation triggers to allow status changes without re-validating insurance/doctor
-- This allows cancellation, confirmation, and unconfirmation of appointments
-- without requiring insurance/active doctor validation

-- Update validate_patient_insurance to skip validation on status-only updates
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
  -- Skip validation if only status/audit fields changed (UPDATE operation)
  IF TG_OP = 'UPDATE' THEN
    IF (
      OLD.medico_id = NEW.medico_id AND
      OLD.paciente_id = NEW.paciente_id AND
      OLD.atendimento_id = NEW.atendimento_id AND
      COALESCE(OLD.convenio, '') = COALESCE(NEW.convenio, '')
    ) THEN
      -- Only status/confirmation/cancellation changed - skip validation
      RETURN NEW;
    END IF;
  END IF;

  -- Validate insurance only for INSERT or when core data changed
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

-- Update validate_doctor_active to skip validation on status-only updates
CREATE OR REPLACE FUNCTION public.validate_doctor_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doctor_active BOOLEAN;
BEGIN
  -- Skip validation if doctor didn't change (UPDATE operation)
  IF TG_OP = 'UPDATE' THEN
    IF OLD.medico_id = NEW.medico_id THEN
      -- Doctor didn't change - skip validation
      RETURN NEW;
    END IF;
  END IF;

  -- Validate active doctor only for INSERT or when doctor changed
  SELECT m.ativo
  INTO doctor_active
  FROM public.medicos m
  WHERE m.id = NEW.medico_id;
  
  IF NOT COALESCE(doctor_active, false) THEN
    RAISE EXCEPTION 'Não é possível agendar com médico inativo';
  END IF;
  
  RETURN NEW;
END;
$$;