-- Normalizar convênios existentes na tabela pacientes para UPPERCASE
UPDATE public.pacientes 
SET convenio = UPPER(TRIM(convenio))
WHERE convenio IS NOT NULL 
  AND convenio != UPPER(TRIM(convenio));