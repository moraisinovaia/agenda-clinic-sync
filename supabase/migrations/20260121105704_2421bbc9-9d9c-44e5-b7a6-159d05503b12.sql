-- 1. Criar função de normalização
CREATE OR REPLACE FUNCTION normalize_patient_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.nome_completo := UPPER(TRIM(NEW.nome_completo));
  IF NEW.convenio IS NOT NULL THEN
    NEW.convenio := UPPER(TRIM(NEW.convenio));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Criar trigger para normalização automática
DROP TRIGGER IF EXISTS trigger_normalize_patient ON pacientes;
CREATE TRIGGER trigger_normalize_patient
BEFORE INSERT OR UPDATE ON pacientes
FOR EACH ROW EXECUTE FUNCTION normalize_patient_name();

-- 3. Migrar dados existentes para MAIÚSCULAS
UPDATE pacientes 
SET nome_completo = UPPER(TRIM(nome_completo)),
    convenio = UPPER(TRIM(convenio)),
    updated_at = now()
WHERE nome_completo IS DISTINCT FROM UPPER(TRIM(nome_completo))
   OR convenio IS DISTINCT FROM UPPER(TRIM(convenio));