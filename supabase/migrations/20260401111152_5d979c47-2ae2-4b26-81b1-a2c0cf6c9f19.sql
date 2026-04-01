UPDATE medicos 
SET convenios_aceitos = array_cat(convenios_aceitos, ARRAY['SUS AFRANIO', 'CORTESIA']),
    updated_at = now()
WHERE id = 'f9a5aab1-5ae1-4b9e-8e26-153beb3f88da'
AND NOT ('SUS AFRANIO' = ANY(COALESCE(convenios_aceitos, '{}')));