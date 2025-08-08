-- Adicionar convênios específicos ao Dr. Carlos
UPDATE public.medicos
SET convenios_aceitos = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(public.medicos.convenios_aceitos, '{}')::text[] || ARRAY['Óticas','Medprev','Semaryprev','AgendaVale']::text[]
    )
  )
)
WHERE nome ILIKE 'Dr. Carlos%';
