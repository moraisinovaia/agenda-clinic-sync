-- Normalizar todos os convenios_aceitos para MAIÚSCULO para consistência

UPDATE public.medicos
SET convenios_aceitos = ARRAY(
  SELECT UPPER(TRIM(unnest(convenios_aceitos)))
)
WHERE convenios_aceitos IS NOT NULL AND array_length(convenios_aceitos, 1) > 0;