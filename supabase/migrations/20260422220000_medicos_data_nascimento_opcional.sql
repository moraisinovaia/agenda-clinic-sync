ALTER TABLE public.medicos
  ADD COLUMN IF NOT EXISTS data_nascimento_opcional BOOLEAN DEFAULT FALSE;

UPDATE public.medicos
SET data_nascimento_opcional = TRUE
WHERE id IN (
  '1e110923-50df-46ff-a57a-29d88e372900',
  'e6453b94-840d-4adf-ab0f-fc22be7cd7f5',
  '9d5d0e63-098b-4282-aa03-db3c7e012579'
);
