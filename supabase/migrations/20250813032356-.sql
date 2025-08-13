-- Add missing procedures to doctors' schedules
WITH docs AS (
  SELECT 
    (SELECT id FROM public.medicos WHERE nome ILIKE 'Dr.%Sydney%') AS dr_sydney,
    (SELECT id FROM public.medicos WHERE nome ILIKE 'Dra.%Juliana%') AS dra_juliana,
    (SELECT id FROM public.medicos WHERE nome ILIKE 'Dra.%Lara%') AS dra_lara
)
INSERT INTO public.atendimentos (nome, tipo, medico_id, ativo)
SELECT v.nome, 'procedimento'::varchar, v.medico_id, true
FROM (
  SELECT 'Musectomia'::varchar AS nome, (SELECT dr_sydney FROM docs) AS medico_id UNION ALL
  SELECT 'Balão Intragástrico'::varchar, (SELECT dr_sydney FROM docs) UNION ALL
  SELECT 'Polipectomia do Cólon'::varchar, (SELECT dr_sydney FROM docs) UNION ALL
  SELECT 'Polipectomia do Cólon'::varchar, (SELECT dra_juliana FROM docs) UNION ALL
  SELECT 'Polipectomia do Cólon'::varchar, (SELECT dra_lara FROM docs) UNION ALL
  SELECT 'Ligadura Elástica'::varchar, (SELECT dr_sydney FROM docs) UNION ALL
  SELECT 'Ligadura Elástica'::varchar, (SELECT dra_juliana FROM docs) UNION ALL
  SELECT 'Ligadura Elástica'::varchar, (SELECT dra_lara FROM docs)
) v
WHERE v.medico_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM public.atendimentos a 
  WHERE a.medico_id = v.medico_id AND a.nome = v.nome
);

-- Optional: ensure medico_nome is synced for new rows (trigger already handles on insert)
