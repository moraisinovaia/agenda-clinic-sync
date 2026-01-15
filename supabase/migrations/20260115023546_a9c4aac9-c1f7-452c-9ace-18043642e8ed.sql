-- Criar função para normalizar convênio automaticamente
CREATE OR REPLACE FUNCTION public.normalize_patient_convenio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Normalizar convênio para UPPERCASE e remover espaços extras
  IF NEW.convenio IS NOT NULL THEN
    NEW.convenio := UPPER(TRIM(NEW.convenio));
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para INSERT e UPDATE
DROP TRIGGER IF EXISTS trigger_normalize_patient_convenio ON public.pacientes;

CREATE TRIGGER trigger_normalize_patient_convenio
BEFORE INSERT OR UPDATE OF convenio ON public.pacientes
FOR EACH ROW
EXECUTE FUNCTION public.normalize_patient_convenio();