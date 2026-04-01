
-- Guilherme: adicionar MEDPREV
UPDATE medicos 
SET convenios_aceitos = array_append(convenios_aceitos, 'MEDPREV'),
    updated_at = now()
WHERE id = 'f9a5aab1-5ae1-4b9e-8e26-153beb3f88da'
AND NOT ('MEDPREV' = ANY(COALESCE(convenios_aceitos, '{}')));

-- Camila: corrigir MEDREV → MEDPREV, adicionar HGU SAUDE e SUS CASA NOVA
UPDATE medicos 
SET convenios_aceitos = array_cat(
  array_remove(convenios_aceitos, 'MEDREV'),
  ARRAY['MEDPREV', 'HGU SAUDE', 'SUS CASA NOVA']
),
updated_at = now()
WHERE id = 'e61c3063-97aa-408b-b6a7-2dbf56920f08';
