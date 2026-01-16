-- Remover a função antiga com assinatura exata (date/time)
DROP FUNCTION IF EXISTS public.criar_agendamento_atomico(
  text,
  date,
  text,
  text,
  text,
  uuid,
  uuid,
  date,
  time without time zone,
  text,
  text,
  uuid,
  uuid,
  boolean
);

-- Garantir permissões na função restante (text/text)
GRANT EXECUTE ON FUNCTION public.criar_agendamento_atomico(
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
) TO anon, authenticated;