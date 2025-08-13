-- Ensure Dr. Max has Teste Ergométrico active and Ecocardiograma inactive
WITH doc AS (
  SELECT id FROM public.medicos WHERE nome ILIKE 'Dr.%Max%' LIMIT 1
)
-- Insert Teste Ergométrico if missing  
INSERT INTO public.atendimentos (nome, tipo, medico_id, ativo)
SELECT 'Teste Ergométrico'::varchar, 'exame'::varchar, d.id, true
FROM doc d
WHERE d.id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.atendimentos a
    WHERE a.medico_id = d.id AND a.nome = 'Teste Ergométrico'
  );

-- Deactivate Ecocardiograma for Dr. Max only (if exists)
UPDATE public.atendimentos a
SET ativo = false
FROM (SELECT id FROM public.medicos WHERE nome ILIKE 'Dr.%Max%' LIMIT 1) doc
WHERE a.medico_id = doc.id
  AND a.nome = 'Ecocardiograma';

-- Verify the changes
SELECT 
  m.nome,
  a.nome as atendimento,
  a.tipo,
  a.ativo
FROM medicos m
JOIN atendimentos a ON a.medico_id = m.id
WHERE m.nome ILIKE '%Max%'
ORDER BY a.ativo DESC, a.nome;