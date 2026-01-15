-- Corrigir trigger validate_patient_insurance para usar comparação normalizada de convênios
CREATE OR REPLACE FUNCTION public.validate_patient_insurance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  patient_insurance TEXT;
  patient_insurance_normalized TEXT;
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
    -- CORREÇÃO: Normalizar para comparação case-insensitive
    patient_insurance_normalized := regexp_replace(upper(trim(COALESCE(patient_insurance, ''))), '[^A-Z0-9%]+', '', 'g');
    
    IF NOT EXISTS (
      SELECT 1 FROM unnest(doctor_insurances) AS conv
      WHERE regexp_replace(upper(trim(conv)), '[^A-Z0-9%]+', '', 'g') = patient_insurance_normalized
    ) THEN
      RAISE EXCEPTION 'Convênio "%" não é aceito por este médico', patient_insurance;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;