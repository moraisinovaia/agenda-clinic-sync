DROP FUNCTION IF EXISTS public.criar_agendamento_atomico(
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  boolean,
  uuid
);

NOTIFY pgrst, 'reload schema';