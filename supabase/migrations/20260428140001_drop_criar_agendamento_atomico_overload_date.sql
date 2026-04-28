-- Remove overload legado com tipos DATE/TIME nativos (criado por migrations geradas no dashboard).
-- O frontend envia strings (TEXT); esse overload tinha o bug do lookup por convenio.
-- Mantemos apenas o overload TEXT corrigido em 20260428140000.
DROP FUNCTION IF EXISTS public.criar_agendamento_atomico(
  text, date, text, text, text, uuid, uuid, date, time without time zone,
  text, text, uuid, uuid, boolean
);
