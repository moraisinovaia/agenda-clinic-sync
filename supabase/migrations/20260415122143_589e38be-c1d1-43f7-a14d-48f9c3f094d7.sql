UPDATE medicos 
SET convenios_aceitos = array_append(convenios_aceitos, 'MEDPREV'),
    updated_at = now()
WHERE id = 'ddf2d7e6-2c0f-4ef3-b3c7-f867078917cf'
AND cliente_id = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a'
AND NOT ('MEDPREV' = ANY(convenios_aceitos));