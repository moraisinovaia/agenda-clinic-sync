-- Atualiza convênios aceitos para o(s) médico(s) Dr. Carlos
UPDATE public.medicos
SET convenios_aceitos = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(public.medicos.convenios_aceitos, ARRAY[]::text[]) ||
      ARRAY['Óticas','Medprev','Semaryprev','AgendaVale']::text[]
    )
  )
)
WHERE nome ILIKE 'Dr. Carlos%';

-- Verificação rápida (somente leitura)
-- SELECT id, nome, convenios_aceitos FROM public.medicos WHERE nome ILIKE 'Dr. Carlos%';