-- Adicionar "unimed intercâmbio" aos médicos que já atendem outros tipos de Unimed
UPDATE medicos 
SET convenios_aceitos = array_append(convenios_aceitos, 'unimed intercâmbio')
WHERE 'unimed nacional' = ANY(convenios_aceitos) 
   OR 'unimed regional' = ANY(convenios_aceitos) 
   OR 'unimed 40%' = ANY(convenios_aceitos) 
   OR 'unimed 20%' = ANY(convenios_aceitos);